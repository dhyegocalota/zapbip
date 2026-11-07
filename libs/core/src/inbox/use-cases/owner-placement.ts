import { MediaOrigin, MediaSourceKind, MessageDirection, MessageKind, RoutingRule, type OwnerLocale } from '@zapbip/types';
import { MEDIA_MAX_BYTES, MEDIA_RETENTION_MS, NOTICE_QUICK_REPLY_ID, WINDOW_MS } from '../constants';
import type { AgentName } from '../connection';
import type { RoutingList, StoredMedia } from '../inbox-records';
import type { MediaFields, Message, MessageContent } from '../message';
import { parseOptionId, parseRouteOptionId } from '../option-id';
import type { CoreDependencies } from '../ports';
import type { Question, QuestionAnswer } from '../question';
import { routeOwnerMessage, type RoutingDecision } from '../routing';
import { buildMediaContent } from './media-content';
import { listRoutingAgents } from './routing-list';
import type { OwnerInboundContent, UnavailableOwnerMedia } from './types';

export type ArrivalContent = OwnerInboundContent | UnavailableOwnerMedia;
export type ArrivalMessage = { at: number; replyToMessageId: string | null; forwarded: boolean; content: ArrivalContent };
export type StoredMediaContent = Extract<OwnerInboundContent, { mediaId: string }>;
export type RouteTarget = { messageIds: string[]; agent: AgentName; isKnownAgent: boolean };
export type PendingAnswer = { questionId: string; optionIndex: number | null; text: string };
export type OwnerPrompt = { listedAgents: AgentName[]; announcesNoAgents: boolean; reminderFor: RoutingList | null };
export type Placement = {
  content: MessageContent;
  replyToMessageId: string | null;
  decision: RoutingDecision;
  answer: PendingAnswer | null;
  prompt: OwnerPrompt;
  isRoutedNowhere: boolean;
};
export type Arrival = { dependencies: CoreDependencies; ownerLocale: OwnerLocale; ownerMessage: ArrivalMessage };
export type ArrivalPlan = {
  routeTarget: RouteTarget | null;
  isStaleRoute: boolean;
  isUnknownAgentRoute: boolean;
  placement: Placement | null;
  unreadBefore: number;
};

type ChoiceContent = Extract<OwnerInboundContent, { kind: MessageKind.Choice }>;
type PlainContent = Exclude<ArrivalContent, ChoiceContent>;
type TappedOption = { question: Question; selected: Question['options'][number] };

const NO_PROMPT: OwnerPrompt = { listedAgents: [], announcesNoAgents: false, reminderFor: null };

export function isMediaKind(content: ArrivalContent): content is StoredMediaContent | UnavailableOwnerMedia {
  return content.kind in MEDIA_MAX_BYTES;
}

export function isStoredMedia(content: ArrivalContent): content is StoredMediaContent {
  return isMediaKind(content) && 'mediaId' in content;
}

function mediaFieldsOf(content: StoredMediaContent | UnavailableOwnerMedia): MediaFields {
  const { filename, caption } = content;
  if (!isStoredMedia(content)) return { source: { kind: MediaSourceKind.Unavailable }, mimeType: null, sizeBytes: null, filename, caption };
  const { mediaId, mimeType, sizeBytes } = content;
  return { source: { kind: MediaSourceKind.Stored, mediaId }, mimeType, sizeBytes, filename, caption };
}

function toMessageContent(content: PlainContent): MessageContent {
  if (!isMediaKind(content)) return content;
  return buildMediaContent({ mediaKind: content.kind, voice: content.voice, fields: mediaFieldsOf(content) });
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

async function findRouteTarget(input: { dependencies: CoreDependencies; optionId: string }): Promise<RouteTarget | null> {
  const { repository } = input.dependencies;
  const route = parseRouteOptionId({ optionId: input.optionId });
  if (route === null) return null;
  const [held, agents] = await Promise.all([repository.listHeld(), repository.listAgents()]);
  const isHeld = held.some((message) => message.messageId === route.messageId);
  if (!isHeld) return null;
  const isKnownAgent = agents.some((record) => record.agent === route.agent);
  return { messageIds: held.map((message) => message.messageId), agent: route.agent, isKnownAgent };
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

async function placeContent(input: Arrival & { content: MessageContent }): Promise<Placement> {
  const { dependencies, ownerMessage, content } = input;
  const { repository } = dependencies;
  const [reference, openQuestions, agents, lastAgentWrite, held, routingList] = await Promise.all([
    findReference(input),
    repository.listOpenQuestions(),
    repository.listAgents(),
    repository.findLastAgentWrite({ since: ownerMessage.at - WINDOW_MS }),
    repository.listHeld(),
    repository.findRoutingList(),
  ]);
  const routingListOpen = routingList !== null;
  const isOwnWords = !ownerMessage.forwarded;
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
  const listedAgents = decision.sendsRoutingList && shouldTellOwner ? await listRoutingAgents({ dependencies }) : [];
  const isHeldBehindOpenList = decision.rule === RoutingRule.AskOwner && routingList !== null && !routingList.reminded && shouldTellOwner;
  const reminderFor = isHeldBehindOpenList ? routingList : null;
  const announcesNoAgents = decision.rule === RoutingRule.AskOwner && agents.length === 0 && held.length === 0 && shouldTellOwner;
  return {
    content: routedContent,
    replyToMessageId: ownerMessage.replyToMessageId,
    decision,
    answer: isOwnWords ? pendingAnswerOf({ content: routedContent, answersQuestionId: decision.answersQuestionId }) : null,
    prompt: { listedAgents, announcesNoAgents, reminderFor },
    isRoutedNowhere: content.kind === MessageKind.Reaction && decision.agent === null,
  };
}

async function placeChoice(input: Arrival & { choice: ChoiceContent }): Promise<Placement> {
  const isOwnWords = !input.ownerMessage.forwarded;
  const tapped = isOwnWords ? await findTappedOption({ dependencies: input.dependencies, optionId: input.choice.optionId }) : null;
  if (tapped !== null) return placeTap({ tapped });
  return placeContent({ ...input, content: { kind: MessageKind.Text, text: input.choice.optionTitle } });
}

function placeOwnerContent(input: Arrival & { content: ArrivalContent }): Promise<Placement> {
  const { content } = input;
  if (content.kind === MessageKind.Choice) return placeChoice({ ...input, choice: content });
  return placeContent({ ...input, content: toMessageContent(content) });
}

export async function planArrival(input: Arrival): Promise<ArrivalPlan> {
  const { dependencies, ownerMessage } = input;
  const { content } = ownerMessage;
  const isNoticeQuickReply = content.kind === MessageKind.Choice && content.optionId === NOTICE_QUICK_REPLY_ID;
  const routeTarget =
    content.kind === MessageKind.Choice && !isNoticeQuickReply ? await findRouteTarget({ dependencies, optionId: content.optionId }) : null;
  const isRouteOption = content.kind === MessageKind.Choice && parseRouteOptionId({ optionId: content.optionId }) !== null;
  const isStaleRoute = isRouteOption && routeTarget === null;
  const isUnknownAgentRoute = routeTarget !== null && !routeTarget.isKnownAgent;
  const isPlaced = !isNoticeQuickReply && !isRouteOption;
  const placement = isPlaced ? await placeOwnerContent({ ...input, content }) : null;
  const placedAgent = placement === null ? null : placement.decision.agent;
  const unreadBefore = placedAgent === null ? 0 : await dependencies.repository.countUnread({ agent: placedAgent });
  return { routeTarget, isStaleRoute, isUnknownAgentRoute, placement, unreadBefore };
}

export function buildPlacedMessage(input: { messageId: string; at: number; forwarded: boolean; placement: Placement }): Message {
  const { messageId, at, forwarded, placement } = input;
  return {
    messageId,
    direction: MessageDirection.FromOwner,
    agent: placement.decision.agent,
    at,
    replyToMessageId: placement.replyToMessageId,
    delivery: null,
    readByAgent: placement.isRoutedNowhere,
    forwarded,
    ...placement.content,
  };
}

export function buildPlacedAnswer(input: {
  placement: Placement;
  messageId: string;
  answeredAt: number;
}): { questionId: string; answer: QuestionAnswer } | null {
  const { placement, messageId, answeredAt } = input;
  if (placement.answer === null) return null;
  const { questionId, optionIndex, text } = placement.answer;
  return { questionId, answer: { optionIndex, text, answerMessageId: messageId, answeredAt } };
}

export function buildOwnerMedia(input: { content: StoredMediaContent; receivedAt: number }): StoredMedia {
  const { content, receivedAt } = input;
  return {
    mediaId: content.mediaId,
    origin: MediaOrigin.Owner,
    mimeType: content.mimeType,
    sizeBytes: content.sizeBytes,
    filename: content.filename,
    expiresAt: null,
    receivedAt,
    retentionUntil: receivedAt + MEDIA_RETENTION_MS,
  };
}
