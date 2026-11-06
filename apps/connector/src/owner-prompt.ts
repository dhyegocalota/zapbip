import type { Message } from '@zapbip/core';

export function escapeChannelText(input: { text: string }): string {
  void input;
  throw new Error('escapeChannelText is not implemented');
}

export function ownerMessageText(input: { message: Message }): string {
  void input;
  throw new Error('ownerMessageText is not implemented');
}

export function buildOwnerPrompt(input: { message: Message }): string {
  void input;
  throw new Error('buildOwnerPrompt is not implemented');
}
