import { runSocketSession } from './connect';
import { logConnectorEventToStderr } from './log';
import { formatListenLine } from './owner-notice';
import { createWakeQueue } from './wake-queue';

export function runListen(input: { socketLink: string; write: (input: { line: string }) => void; signal: AbortSignal }): Promise<number> {
  const { socketLink, write, signal } = input;
  return runSocketSession({
    socketLink,
    signal,
    log: logConnectorEventToStderr,
    connectedFields: {},
    createQueue: ({ sendDone }) =>
      createWakeQueue({
        sendDone,
        runWake: async ({ message }) => write({ line: formatListenLine({ message }) }),
      }),
  });
}
