import type { Message } from '@zapbip/core';
import { CHANNEL_SENDER, type MessageKind } from '@zapbip/types';
import { CHANNEL_PROTOCOL } from './channel-protocol';
import { escapeChannelText, ownerMessageText } from './owner-prompt';

export type OwnerNotice = { messageId: string; kind: MessageKind; sender: string; verified: boolean; forwarded: boolean; text: string };
export type ChannelNotification = { method: string; params: { content: string; meta: Record<string, string> } };

export function buildOwnerNotice(input: { message: Message }): OwnerNotice {
  const { message } = input;
  return {
    messageId: message.messageId,
    kind: message.kind,
    sender: CHANNEL_SENDER,
    verified: message.forwarded === false,
    forwarded: message.forwarded,
    text: ownerMessageText({ message }),
  };
}

export function formatListenLine(input: { message: Message }): string {
  return `${JSON.stringify(buildOwnerNotice(input))}\n`;
}

export function buildChannelNotification(input: { message: Message }): ChannelNotification {
  const { text, verified, forwarded } = buildOwnerNotice(input);
  return {
    method: CHANNEL_PROTOCOL.notificationMethod,
    params: {
      content: escapeChannelText({ text }),
      meta: { sender: CHANNEL_SENDER, verified: String(verified), forwarded: String(forwarded) },
    },
  };
}
