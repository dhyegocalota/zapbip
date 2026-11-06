import {
  AgentWakeReason,
  DeliveryState,
  IdPrefix,
  InboxCopyKey,
  MediaOrigin,
  MediaSourceKind,
  MessageDirection,
  MessageKind,
  RoutingRule,
  WakeOutcome,
  type OwnerLocale,
} from '@zapbip/types';
import { MEDIA_MAX_BYTES, MEDIA_RETENTION_MS, NOTICE_QUICK_REPLY_ID, QUESTION_MAX_OPTIONS, WINDOW_MS } from '../constants';
import type { AgentName } from '../connection';
import { renderCopy } from '../inbox-copy';
import type { Message, MessageContent } from '../message';
import { formatRoutingListQuestionId, parseOptionId, parseRouteOptionId } from '../option-id';
import type { CoreDependencies } from '../ports';
import type { Question } from '../question';
import { routeOwnerMessage, type RoutingDecision } from '../routing';
import { assertVoiceNote } from '../validation';
import { deliverToOwner } from './deliver-to-owner';
import { flushQueue } from './flush-queue';
import { buildMediaContent } from './media-content';
import type { OwnerInboundContent, OwnerInboundMessage, ReceiveOwnerMessageInput, ReceiveResult } from './types';

type ChoiceContent = Extract<OwnerInboundContent, { kind: MessageKind.Choice }>;
type PlainContent = Exclude<OwnerInboundContent, ChoiceContent>;
type MediaContent = Extract<OwnerInboundContent, { mediaId: string }>;
type RouteTarget = { messageIds: string[]; agent: AgentName };
type PendingAnswer = { questionId: string; optionIndex: number | null; text: string };
type OwnerPrompt = { listedAgents: AgentName[]; announcesNoAgents: boolean };
type Placement = {
  content: MessageContent;
  replyToMessageId: string | null;
  decision: RoutingDecision;
  answer: PendingAnswer | null;
  prompt: OwnerPrompt;
  isRoutedNowhere: boolean;
};
type TappedOption = { question: Question; selected: Question['options'][number] };
type Arrival = { dependencies: CoreDependencies; ownerLocale: OwnerLocale; ownerMessage: OwnerInboundMessage };

const NO_PROMPT: OwnerPrompt = { listedAgents: [], announcesNoAgents: false };

function isMediaContent(content: OwnerInboundContent): content is MediaContent {
  return content.kind in MEDIA_MAX_BYTES;
}

function toMessageContent(content: PlainContent): MessageContent {
  if (!isMediaContent(content)) return content;
  const { mediaId, mimeType, sizeBytes, filename, caption } = content;
  const fields = { source: { kind: MediaSourceKind.Stored as const, mediaId }, mimeType, sizeBytes, filename, caption };
  return buildMediaContent({ mediaKind: content.kind, voice: content.voice, fields });
}

function textOf(content: MessageContent): string | null {
  return content.kind === MessageKind.Text ? content.text : null;
}

function withRoutedText(input: { content: MessageContent; textForAgent: string | null }): MessageContent {
  if (input.content.kind !== MessageKind.Text || input.textForAgent === null) return input.content;
  return { kind: MessageKind.Text, text: input.textForAgent };
}

function pendingAnswerOf(input: { content: MessageContent; answersQuestionId: string | null }): PendingAnswer | null {
  const { content, answersQuestionId: questionId } = input;
  if (questionId === null) return null;
  if (content.kind === MessageKind.Text) return { questionId, optionIndex: null, text: content.text };
  if (content.kind === MessageKind.Reaction && content.emoji !== null) return { questionId, optionIndex: null, text: content.emoji };
  return null;
}

async function storeOwnerMedia(input: { dependencies: CoreDependencies; content: MediaContent }): Promise<void> {
  const { dependencies, content } = input;
  const receivedAt = dependencies.clock.now();
  await dependencies.repository.insertMedia({
    media: {
      mediaId: content.mediaId,
      origin: MediaOrigin.Owner,
      mimeType: content.mimeType,
      sizeBytes: content.sizeBytes,
      filename: content.filename,
      expiresAt: null,
      receivedAt,
      retentionUntil: receivedAt + MEDIA_RETENTION_MS,
    },
  });
}

async function wakeAgent(
  input: Arrival & { agent: AgentName; unreadBefore: number; answeredQuestionId: string | null; shouldTellOwner: boolean },
): Promise<void> {
  const { dependencies, ownerLocale, agent, unreadBefore, answeredQuestionId, shouldTellOwner } = input;
  const { waiters, waker, ids } = dependencies;
  const hasLiveWaiter = waiters.hasLiveWaiter({ agent, questionId: answeredQuestionId });
  if (answeredQuestionId === null) waiters.resolveAgentMessage({ agent });
  if (answeredQuestionId !== null) waiters.resolveQuestionAnswer({ questionId: answeredQuestionId });
  const isNewBatch = unreadBefore === 0;
  if (hasLiveWaiter || !isNewBatch) return;
  const outcome = await waker.notify({ agent, reason: AgentWakeReason.MessageWaiting });
  if (outcome === WakeOutcome.Woken || !shouldTellOwner) return;
  const text = renderCopy({ key: InboxCopyKey.AgentNotListening, locale: ownerLocale, values: { agent } });
  await deliverToOwner({
    dependencies,
    ownerLocale,
    agent: null,
    messageId: ids.next({ prefix: IdPrefix.Message }),
    content: { kind: MessageKind.Text, text },
    replyToMessageId: null,
  });
}

async function findRouteTarget(input: { dependencies: CoreDependencies; optionId: string }): Promise<RouteTarget | null> {
  const { repository } = input.dependencies;
  const route = parseRouteOptionId({ optionId: input.optionId });
  if (route === null) return null;
  const [held, agents] = await Promise.all([repository.listHeld(), repository.listAgents()]);
  const isLive = held.some((message) => message.messageId === route.messageId) && agents.some((record) => record.agent === route.agent);
  if (!isLive) return null;
  return { messageIds: held.map((message) => message.messageId), agent: route.agent };
}

async function applyRouteTarget(input: Arrival & { target: RouteTarget }): Promise<ReceiveResult> {
  const { repository } = input.dependencies;
  const { messageIds, agent } = input.target;
  const unreadBefore = await repository.countUnread({ agent });
  await repository.assignAgent({ messageIds, agent });
  await wakeAgent({ ...input, agent, unreadBefore, answeredQuestionId: null, shouldTellOwner: true });
  return { messageId: null, agent, duplicate: false };
}

async function findTappedOption(input: { dependencies: CoreDependencies; optionId: string }): Promise<TappedOption | null> {
  const parsed = parseOptionId({ optionId: input.optionId });
  if (parsed === null) return null;
  const question = await input.dependencies.repository.findQuestion({ questionId: parsed.questionId });
  if (question === null) return null;
  const selected = question.options.find((option) => option.optionIndex === parsed.optionIndex);
  if (selected === undefined) return null;
  return { question, selected };
}

function placeTap(input: { tapped: TappedOption }): Placement {
  const { question, selected } = input.tapped;
  const isAnswered = question.answer !== null;
  const decision: RoutingDecision = {
    rule: RoutingRule.ButtonReply,
    agent: question.agent,
    answersQuestionId: isAnswered ? null : question.questionId,
    textForAgent: selected.title,
    sendsRoutingList: false,
  };
  if (isAnswered)
    return {
      content: { kind: MessageKind.Text, text: selected.title },
      replyToMessageId: question.promptMessageId,
      decision,
      answer: null,
      prompt: NO_PROMPT,
      isRoutedNowhere: false,
    };
  return {
    content: { kind: MessageKind.Choice, questionId: question.questionId, options: question.options, selected },
    replyToMessageId: null,
    decision,
    answer: { questionId: question.questionId, optionIndex: selected.optionIndex, text: selected.title },
    prompt: NO_PROMPT,
    isRoutedNowhere: false,
  };
}

async function findReference(
  input: Arrival & { content: MessageContent },
): Promise<{ message: Message | null; question: Question | null }> {
  const { repository } = input.dependencies;
  const referenceId = input.content.kind === MessageKind.Reaction ? input.content.targetMessageId : input.ownerMessage.replyToMessageId;
  const message = referenceId === null ? null : await repository.findMessage({ messageId: referenceId });
  const isPrompt = message !== null && message.direction === MessageDirection.ToOwner && message.kind === MessageKind.Choice;
  const question = isPrompt ? await repository.findQuestion({ questionId: message.questionId }) : null;
  return { message, question };
}

async function isRoutingListPending(input: { dependencies: CoreDependencies; held: Message[] }): Promise<boolean> {
  const { repository } = input.dependencies;
  const prompts = await Promise.all(
    input.held.map((message) => repository.findChoicePrompt({ questionId: formatRoutingListQuestionId({ messageId: message.messageId }) })),
  );
  return prompts.some((prompt) => prompt !== null && prompt.delivery !== DeliveryState.Failed);
}

async function placeContent(input: Arrival & { content: MessageContent }): Promise<Placement> {
  const { dependencies, ownerMessage, content } = input;
  const { repository } = dependencies;
  const [reference, openQuestions, agents, lastAgentWrite, held] = await Promise.all([
    findReference(input),
    repository.listOpenQuestions(),
    repository.listAgents(),
    repository.findLastAgentWrite({ since: ownerMessage.at - WINDOW_MS }),
    repository.listHeld(),
  ]);
  const routingListOpen = await isRoutingListPending({ dependencies, held });
  const decision = routeOwnerMessage({
    text: textOf(content),
    referencedMessage: reference.message,
    referencedQuestion: reference.question,
    openQuestions,
    agents,
    lastAgentWrite,
    routingListOpen,
  });
  const routedContent = withRoutedText({ content, textForAgent: decision.textForAgent });
  const shouldTellOwner = content.kind !== MessageKind.Reaction;
  const listedAgents =
    decision.sendsRoutingList && shouldTellOwner
      ? [...agents]
          .sort((first, second) => second.lastSeenAt - first.lastSeenAt)
          .slice(0, QUESTION_MAX_OPTIONS)
          .map((record) => record.agent)
      : [];
  const announcesNoAgents = decision.rule === RoutingRule.AskOwner && agents.length === 0 && held.length === 0 && shouldTellOwner;
  return {
    content: routedContent,
    replyToMessageId: ownerMessage.replyToMessageId,
    decision,
    answer: pendingAnswerOf({ content: routedContent, answersQuestionId: decision.answersQuestionId }),
    prompt: { listedAgents, announcesNoAgents },
    isRoutedNowhere: content.kind === MessageKind.Reaction && decision.agent === null,
  };
}

async function placeChoice(input: Arrival & { choice: ChoiceContent }): Promise<Placement> {
  const tapped = await findTappedOption({ dependencies: input.dependencies, optionId: input.choice.optionId });
  if (tapped !== null) return placeTap({ tapped });
  return placeContent({ ...input, content: { kind: MessageKind.Text, text: input.choice.optionTitle } });
}

async function promptOwner(input: Arrival & { heldMessageId: string; prompt: OwnerPrompt }): Promise<void> {
  const { dependencies, ownerLocale, heldMessageId, prompt } = input;
  const baseDelivery = { dependencies, ownerLocale, agent: null, replyToMessageId: null };
  if (prompt.listedAgents.length > 0) {
    const options = prompt.listedAgents.map((agent, optionIndex) => ({ optionIndex, title: agent, description: null }));
    const questionId = formatRoutingListQuestionId({ messageId: heldMessageId });
    await deliverToOwner({
      ...baseDelivery,
      messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
      content: { kind: MessageKind.Choice, questionId, options, selected: null },
    });
  }
  if (prompt.announcesNoAgents) {
    const text = renderCopy({ key: InboxCopyKey.NoAgents, locale: ownerLocale, values: {} });
    await deliverToOwner({
      ...baseDelivery,
      messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
      content: { kind: MessageKind.Text, text },
    });
  }
}

async function openWindowAndFlush(input: { dependencies: CoreDependencies; at: number }): Promise<void> {
  await input.dependencies.repository.saveWindow({
    window: { lastOwnerMessageAt: input.at, noticeSentForClosedWindow: false, closedAt: null },
  });
  await flushQueue({ dependencies: input.dependencies });
}

function placeOwnerContent(input: Arrival & { content: OwnerInboundContent }): Promise<Placement> {
  const { content } = input;
  if (content.kind === MessageKind.Choice) return placeChoice({ ...input, choice: content });
  return placeContent({ ...input, content: toMessageContent(content) });
}

async function storePlacement(input: Arrival & { content: OwnerInboundContent; placement: Placement }): Promise<string> {
  const { dependencies, ownerMessage, content, placement } = input;
  const { repository, clock, ids } = dependencies;
  const messageId = ids.next({ prefix: IdPrefix.Message });
  if (isMediaContent(content)) await storeOwnerMedia({ dependencies, content });
  await repository.insertMessage({
    message: {
      messageId,
      direction: MessageDirection.FromOwner,
      agent: placement.decision.agent,
      at: ownerMessage.at,
      replyToMessageId: placement.replyToMessageId,
      delivery: null,
      readByAgent: placement.isRoutedNowhere,
      ...placement.content,
    },
  });
  if (placement.answer === null) return messageId;
  const { questionId, optionIndex, text } = placement.answer;
  await repository.saveAnswer({ questionId, answer: { optionIndex, text, answerMessageId: messageId, answeredAt: clock.now() } });
  return messageId;
}

async function deliverPlacement(
  input: Arrival & { placement: Placement; messageId: string; unreadBefore: number; shouldTellOwner: boolean },
): Promise<void> {
  const { placement, messageId, unreadBefore, shouldTellOwner } = input;
  const { agent } = placement.decision;
  if (agent === null) return promptOwner({ ...input, heldMessageId: messageId, prompt: placement.prompt });
  const answeredQuestionId = placement.answer === null ? null : placement.answer.questionId;
  return wakeAgent({ ...input, agent, unreadBefore, answeredQuestionId, shouldTellOwner });
}

async function duplicateResultOf(input: { dependencies: CoreDependencies; wamid: string }): Promise<ReceiveResult> {
  const { repository } = input.dependencies;
  const messageId = await repository.findChannelReceiptMessageId({ wamid: input.wamid });
  if (messageId === null) return { messageId: null, agent: null, duplicate: true };
  const message = await repository.findMessage({ messageId });
  if (message === null) return { messageId, agent: null, duplicate: true };
  return { messageId, agent: message.agent, duplicate: true };
}

async function expireRoute(input: Arrival): Promise<ReceiveResult> {
  const { dependencies, ownerLocale } = input;
  const text = renderCopy({ key: InboxCopyKey.RoutingListExpired, locale: ownerLocale, values: {} });
  await deliverToOwner({
    dependencies,
    ownerLocale,
    agent: null,
    messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
    content: { kind: MessageKind.Text, text },
    replyToMessageId: null,
  });
  return { messageId: null, agent: null, duplicate: false };
}

export async function receiveOwnerMessage(input: ReceiveOwnerMessageInput): Promise<ReceiveResult> {
  const { dependencies, ownerLocale, channelMessageId, ownerMessage } = input;
  const { repository, clock } = dependencies;
  const { content } = ownerMessage;
  const arrival: Arrival = { dependencies, ownerLocale, ownerMessage };
  if (isMediaContent(content)) assertVoiceNote({ kind: content.kind, voice: content.voice });
  const isNoticeQuickReply = content.kind === MessageKind.Choice && content.optionId === NOTICE_QUICK_REPLY_ID;
  const routeTarget =
    content.kind === MessageKind.Choice && !isNoticeQuickReply ? await findRouteTarget({ dependencies, optionId: content.optionId }) : null;
  const isRouteOption = content.kind === MessageKind.Choice && parseRouteOptionId({ optionId: content.optionId }) !== null;
  const isStaleRoute = isRouteOption && routeTarget === null;
  const isPlaced = !isNoticeQuickReply && !isRouteOption;
  const placement = isPlaced ? await placeOwnerContent({ ...arrival, content }) : null;
  const placedAgent = placement === null ? null : placement.decision.agent;
  const unreadBefore = placedAgent === null ? 0 : await repository.countUnread({ agent: placedAgent });
  const isNewMessage = await repository.recordChannelReceipt({ wamid: channelMessageId, receivedAt: clock.now() });
  if (!isNewMessage) return duplicateResultOf({ dependencies, wamid: channelMessageId });
  const messageId = placement === null ? null : await storePlacement({ ...arrival, content, placement });
  if (messageId !== null) await repository.linkChannelReceipt({ wamid: channelMessageId, messageId });
  if (content.kind !== MessageKind.Reaction) await openWindowAndFlush({ dependencies, at: ownerMessage.at });
  if (isStaleRoute) return expireRoute(arrival);
  if (routeTarget !== null) return applyRouteTarget({ ...arrival, target: routeTarget });
  if (placement === null || messageId === null) return { messageId: null, agent: null, duplicate: false };
  const shouldTellOwner = content.kind !== MessageKind.Reaction;
  await deliverPlacement({ ...arrival, placement, messageId, unreadBefore, shouldTellOwner });
  return { messageId, agent: placement.decision.agent, duplicate: false };
}
