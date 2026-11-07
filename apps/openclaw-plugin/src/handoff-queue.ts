import type { Message } from '@zapbip/core';
import { ConnectorLogEvent, SEEN_MESSAGE_LIMIT } from '@zapbip/types';
import type { ConnectorLogger } from './log';

export type HandoffQueue = { enqueue: (input: { message: Message }) => void };

export function createHandoffQueue(input: {
  handOff: (input: { message: Message }) => Promise<void>;
  sendDone: (input: { messageId: string }) => void;
  log: ConnectorLogger;
}): HandoffQueue {
  const { handOff, sendDone, log } = input;
  const acknowledgedIds = new Set<string>();
  const pendingIds = new Set<string>();
  let tail: Promise<void> = Promise.resolve();

  function remember(rememberInput: { messageId: string }): void {
    acknowledgedIds.add(rememberInput.messageId);
    if (acknowledgedIds.size <= SEEN_MESSAGE_LIMIT) return;
    const [oldestId] = acknowledgedIds;
    acknowledgedIds.delete(oldestId as string);
  }

  async function run(runInput: { message: Message }): Promise<void> {
    const { messageId } = runInput.message;
    try {
      await handOff(runInput);
    } catch {
      log({ event: ConnectorLogEvent.PluginHandoffFailed, fields: { messageId } });
      return;
    } finally {
      pendingIds.delete(messageId);
    }
    remember({ messageId });
    sendDone({ messageId });
  }

  function enqueue(enqueueInput: { message: Message }): void {
    const { messageId } = enqueueInput.message;
    if (acknowledgedIds.has(messageId)) return sendDone({ messageId });
    if (pendingIds.has(messageId)) return;
    pendingIds.add(messageId);
    tail = tail.then(() => run(enqueueInput));
  }

  return { enqueue };
}
