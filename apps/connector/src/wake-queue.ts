import type { Message } from '@zapbip/core';

export type WakeQueue = { enqueue: (input: { message: Message }) => void };

export function createWakeQueue(input: {
  runWake: (input: { message: Message }) => Promise<void>;
  sendDone: (input: { messageId: string }) => void;
}): WakeQueue {
  void input;
  throw new Error('createWakeQueue is not implemented');
}
