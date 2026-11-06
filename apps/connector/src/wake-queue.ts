import type { Message } from '@zapbip/core';

export type WakeQueue = { enqueue: (input: { message: Message }) => void; stop: () => void };

export function createWakeQueue(input: {
  runWake: (input: { message: Message }) => Promise<void>;
  sendDone: (input: { messageId: string }) => void;
}): WakeQueue {
  const { runWake, sendDone } = input;
  const acknowledgedIds = new Set<string>();
  const pendingIds = new Set<string>();
  let tail: Promise<void> = Promise.resolve();

  async function wake(wakeInput: { message: Message }): Promise<void> {
    const { messageId } = wakeInput.message;
    try {
      await runWake(wakeInput);
    } catch {
      return;
    } finally {
      pendingIds.delete(messageId);
    }
    acknowledgedIds.add(messageId);
    sendDone({ messageId });
  }

  function enqueue(enqueueInput: { message: Message }): void {
    const { messageId } = enqueueInput.message;
    if (acknowledgedIds.has(messageId)) return sendDone({ messageId });
    if (pendingIds.has(messageId)) return;
    pendingIds.add(messageId);
    tail = tail.then(() => wake(enqueueInput));
  }

  function stop(): void {
    throw new Error('stop is not implemented');
  }

  return { enqueue, stop };
}
