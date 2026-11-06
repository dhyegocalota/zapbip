import type { Message } from '@zapbip/core';
import type { MessageKind } from '@zapbip/types';

export type OwnerNotice = { messageId: string; kind: MessageKind; sender: string; verified: boolean; text: string };
export type ChannelNotification = { method: string; params: { content: string; meta: Record<string, string> } };

export function buildOwnerNotice(_input: { message: Message }): OwnerNotice {
  throw new Error('buildOwnerNotice is not implemented');
}

export function formatListenLine(_input: { message: Message }): string {
  throw new Error('formatListenLine is not implemented');
}

export function buildChannelNotification(_input: { message: Message }): ChannelNotification {
  throw new Error('buildChannelNotification is not implemented');
}
