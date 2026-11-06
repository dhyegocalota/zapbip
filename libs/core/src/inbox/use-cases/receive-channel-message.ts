import { ChannelInboundKind, IdPrefix, MessageKind } from '@zapbip/types';
import { assertVoiceNote } from '../validation';
import { deliverToOwner } from './deliver-to-owner';
import { flushQueue } from './flush-queue';
import { openedWindow } from './open-window';
import { finishArrival } from './owner-arrival';
import {
  buildOwnerMedia,
  buildPlacedAnswer,
  buildPlacedMessage,
  isMediaKind,
  isStoredMedia,
  planArrival,
  type Arrival,
  type ArrivalContent,
  type ArrivalMessage,
} from './owner-placement';
import type { ChannelInboundEntry, ReceiveChannelInput, ReceiveResult } from './types';

type ChannelContext = Pick<ReceiveChannelInput, 'dependencies' | 'ownerLocale' | 'channelMessageId'>;
type OwnerEntry = Extract<ChannelInboundEntry, { kind: ChannelInboundKind.Owner }>;
type UnsupportedEntry = Extract<ChannelInboundEntry, { kind: ChannelInboundKind.Unsupported }>;
type WindowOnlyEntry = Extract<ChannelInboundEntry, { kind: ChannelInboundKind.WindowOnly }>;

const DUPLICATE_RESULT: ReceiveResult = { messageId: null, agent: null, duplicate: true };
const WINDOW_ONLY_RESULT: ReceiveResult = { messageId: null, agent: null, duplicate: false };

async function resolveReactionTarget(input: { context: ChannelContext; content: ArrivalContent }): Promise<ArrivalContent> {
  const { content } = input;
  if (content.kind !== MessageKind.Reaction) return content;
  const { repository } = input.context.dependencies;
  const target = await repository.findMessageByChannelMessageId({ channelMessageId: content.targetMessageId });
  if (target === null) return content;
  return { ...content, targetMessageId: target.messageId };
}

async function resolveOwnerMessage(input: { context: ChannelContext; entry: OwnerEntry }): Promise<ArrivalMessage> {
  const { context, entry } = input;
  const { repository } = context.dependencies;
  const repliedTo =
    entry.replyToChannelMessageId === null
      ? null
      : await repository.findMessageByChannelMessageId({ channelMessageId: entry.replyToChannelMessageId });
  const content = await resolveReactionTarget({ context, content: entry.content });
  return { at: entry.at, replyToMessageId: repliedTo === null ? null : repliedTo.messageId, content };
}

async function sendNotice(input: { context: ChannelContext; text: string }): Promise<void> {
  const { dependencies, ownerLocale } = input.context;
  await deliverToOwner({
    dependencies,
    ownerLocale,
    agent: null,
    messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
    content: { kind: MessageKind.Text, text: input.text },
    replyToMessageId: null,
  });
}

async function commitWindowOnly(input: { context: ChannelContext; at: number }): Promise<boolean> {
  const { dependencies, channelMessageId } = input.context;
  const { repository, clock } = dependencies;
  const window = await repository.findWindow();
  return repository.commitChannelInbound({
    channelMessageId,
    receivedAt: clock.now(),
    message: null,
    answer: null,
    media: null,
    window: openedWindow({ window, at: input.at }),
  });
}

async function receiveWindowOnly(input: { context: ChannelContext; entry: WindowOnlyEntry }): Promise<ReceiveResult> {
  const { context, entry } = input;
  const isNewMessage = await commitWindowOnly({ context, at: entry.at });
  if (!isNewMessage) return DUPLICATE_RESULT;
  await flushQueue({ dependencies: context.dependencies, ownerLocale: context.ownerLocale });
  return WINDOW_ONLY_RESULT;
}

async function receiveUnsupported(input: { context: ChannelContext; entry: UnsupportedEntry }): Promise<ReceiveResult> {
  const { context, entry } = input;
  const result = await receiveWindowOnly({ context, entry: { kind: ChannelInboundKind.WindowOnly, at: entry.at } });
  if (result.duplicate) return result;
  await sendNotice({ context, text: entry.noticeText });
  return result;
}

async function receiveOwner(input: { context: ChannelContext; entry: OwnerEntry }): Promise<ReceiveResult> {
  const { context, entry } = input;
  const { dependencies, ownerLocale, channelMessageId } = context;
  const { repository, clock, ids } = dependencies;
  const ownerMessage = await resolveOwnerMessage(input);
  const { content } = ownerMessage;
  const arrival: Arrival = { dependencies, ownerLocale, ownerMessage };
  if (isMediaKind(content)) assertVoiceNote({ kind: content.kind, voice: content.voice });
  const plan = await planArrival(arrival);
  const messageId = plan.placement === null ? null : ids.next({ prefix: IdPrefix.Message });
  const placed = plan.placement === null || messageId === null ? null : { placement: plan.placement, messageId };
  const isReaction = content.kind === MessageKind.Reaction;
  const currentWindow = await repository.findWindow();
  const receivedAt = clock.now();
  const isNewMessage = await repository.commitChannelInbound({
    channelMessageId,
    receivedAt,
    message: placed === null ? null : buildPlacedMessage({ ...placed, at: ownerMessage.at }),
    answer: placed === null ? null : buildPlacedAnswer({ ...placed, answeredAt: receivedAt }),
    media: placed !== null && isStoredMedia(content) ? buildOwnerMedia({ content, receivedAt }) : null,
    window: isReaction ? currentWindow : openedWindow({ window: currentWindow, at: ownerMessage.at }),
  });
  if (!isNewMessage) return DUPLICATE_RESULT;
  if (!isReaction) await flushQueue({ dependencies, ownerLocale });
  const result = await finishArrival({ ...arrival, plan, messageId });
  if (entry.noticeText !== null) await sendNotice({ context, text: entry.noticeText });
  return result;
}

export async function receiveChannelMessage(input: ReceiveChannelInput): Promise<ReceiveResult> {
  const { dependencies, ownerLocale, channelMessageId, entry } = input;
  const context: ChannelContext = { dependencies, ownerLocale, channelMessageId };
  if (entry.kind === ChannelInboundKind.Owner) return receiveOwner({ context, entry });
  if (entry.kind === ChannelInboundKind.Unsupported) return receiveUnsupported({ context, entry });
  return receiveWindowOnly({ context, entry });
}
