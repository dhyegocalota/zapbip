import {
  ChannelErrorKind,
  ChannelInboundKind,
  DeliveryState,
  MessageDirection,
  MessageKind,
  OwnerLocale,
  ForwardedKind,
} from '@zapbip/types';
import { ChannelError } from '../errors';
import type { Message } from '../message';
import type { ChannelInboundEntry, ReceiveResult } from '../use-cases/types';
import { receiveChannelMessage } from '../use-cases/receive-channel-message';
import type { InMemoryEnvironment } from './in-memory';

let channelMessageCounter = 0;

export function channelError(input: { kind: ChannelErrorKind; message?: string; errorCode?: number | null }): ChannelError {
  const { kind, message = `${kind} error`, errorCode = null } = input;
  return new ChannelError({ kind, message, errorCode });
}

export function ownerTextEntry(input: {
  environment: InMemoryEnvironment;
  text: string;
  replyToChannelMessageId?: string | null;
  forwarded?: ForwardedKind;
  noticeText?: string | null;
}): ChannelInboundEntry {
  const { environment, text, replyToChannelMessageId = null, forwarded = ForwardedKind.None, noticeText = null } = input;
  return {
    kind: ChannelInboundKind.Owner,
    at: environment.clock.now(),
    content: { kind: MessageKind.Text, text },
    replyToChannelMessageId,
    forwarded,
    noticeText,
  };
}

export function receiveChannel(input: {
  environment: InMemoryEnvironment;
  entry: ChannelInboundEntry;
  channelMessageId?: string;
  dependencies?: InMemoryEnvironment['dependencies'];
  ownerLocale?: OwnerLocale;
}): Promise<ReceiveResult> {
  const { environment, entry, dependencies = environment.dependencies, ownerLocale = OwnerLocale.EnglishUs } = input;
  channelMessageCounter += 1;
  const { channelMessageId = `wamid.channel.${channelMessageCounter}` } = input;
  return receiveChannelMessage({ dependencies, ownerLocale, channelMessageId, entry });
}

export async function insertQueued(input: { environment: InMemoryEnvironment; texts: string[]; agent?: string }): Promise<Message[]> {
  const { environment, texts, agent = 'alpha' } = input;
  const messages: Message[] = texts.map((text, index) => ({
    messageId: `queued_${text}`,
    direction: MessageDirection.ToOwner,
    agent,
    at: environment.clock.now() + index,
    replyToMessageId: null,
    delivery: DeliveryState.Queued,
    readByAgent: true,
    forwarded: ForwardedKind.None,
    handedTo: null,
    originMessageId: null,
    kind: MessageKind.Text,
    text,
  }));
  await Promise.all(messages.map((message) => environment.repository.insertMessage({ message })));
  return messages;
}
