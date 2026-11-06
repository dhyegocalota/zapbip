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
  let isStopped = false;

  async function wake(wakeInput: { message: Message }): Promise<void> {
    const { messageId } = wakeInput.message;
    if (isStopped) {
      pendingIds.delete(messageId);
      return;
    }
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
    isStopped = true;
  }

  return { enqueue, stop };
}
