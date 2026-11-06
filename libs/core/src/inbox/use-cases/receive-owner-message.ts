import { IdPrefix, MessageKind } from '@zapbip/types';
import type { CoreDependencies } from '../ports';
import { assertVoiceNote } from '../validation';
import { openWindow } from './open-window';
import { finishArrival } from './owner-arrival';
import {
  buildOwnerMedia,
  buildPlacedAnswer,
  buildPlacedMessage,
  isMediaKind,
  isStoredMedia,
  planArrival,
  type Arrival,
  type Placement,
} from './owner-placement';
import type { ReceiveOwnerMessageInput, ReceiveResult } from './types';

async function duplicateResultOf(input: { dependencies: CoreDependencies; wamid: string }): Promise<ReceiveResult> {
  const { repository } = input.dependencies;
  const messageId = await repository.findChannelReceiptMessageId({ wamid: input.wamid });
  if (messageId === null) return { messageId: null, agent: null, duplicate: true };
  const message = await repository.findMessage({ messageId });
  if (message === null) return { messageId, agent: null, duplicate: true };
  return { messageId, agent: message.agent, duplicate: true };
}

async function storePlacement(input: Arrival & { channelMessageId: string; placement: Placement }): Promise<string> {
  const { dependencies, ownerMessage, channelMessageId, placement } = input;
  const { repository, clock, ids } = dependencies;
  const { content } = ownerMessage;
  const messageId = ids.next({ prefix: IdPrefix.Message });
  if (isStoredMedia(content)) await repository.insertMedia({ media: buildOwnerMedia({ content, receivedAt: clock.now() }) });
  await repository.insertMessage({ message: buildPlacedMessage({ messageId, at: ownerMessage.at, placement }) });
  await repository.saveChannelMessageId({ messageId, channelMessageId });
  const answer = buildPlacedAnswer({ placement, messageId, answeredAt: clock.now() });
  if (answer !== null) await repository.saveAnswer(answer);
  return messageId;
}

export async function receiveOwnerMessage(input: ReceiveOwnerMessageInput): Promise<ReceiveResult> {
  const { dependencies, ownerLocale, channelMessageId, ownerMessage } = input;
  const { repository, clock } = dependencies;
  const { content } = ownerMessage;
  const arrival: Arrival = { dependencies, ownerLocale, ownerMessage };
  if (isMediaKind(content)) assertVoiceNote({ kind: content.kind, voice: content.voice });
  const plan = await planArrival(arrival);
  const isNewMessage = await repository.recordChannelReceipt({ wamid: channelMessageId, receivedAt: clock.now() });
  if (!isNewMessage) return duplicateResultOf({ dependencies, wamid: channelMessageId });
  const messageId = plan.placement === null ? null : await storePlacement({ ...arrival, channelMessageId, placement: plan.placement });
  if (messageId !== null) await repository.linkChannelReceipt({ wamid: channelMessageId, messageId });
  if (content.kind !== MessageKind.Reaction) await openWindow({ dependencies, ownerLocale, at: ownerMessage.at });
  return finishArrival({ ...arrival, plan, messageId });
}
