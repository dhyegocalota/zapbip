import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CHANNEL_CAPABILITY, CHANNEL_INSTRUCTIONS, CHANNEL_SERVER_NAME, CHANNEL_SERVER_VERSION } from '@zapbip/types';
import { runSocketSession } from './connect';
import { logConnectorEventToStderr } from './log';
import { buildChannelNotification } from './owner-notice';
import { createWakeQueue } from './wake-queue';

export async function runChannel(input: { socketLink: string; signal: AbortSignal }): Promise<number> {
  const { socketLink, signal } = input;
  const server = new Server(
    { name: CHANNEL_SERVER_NAME, version: CHANNEL_SERVER_VERSION },
    { capabilities: { experimental: { [CHANNEL_CAPABILITY]: {} } }, instructions: CHANNEL_INSTRUCTIONS },
  );
  const closedController = new AbortController();
  server.onclose = () => closedController.abort();
  await server.connect(new StdioServerTransport());
  try {
    return await runSocketSession({
      socketLink,
      signal: AbortSignal.any([signal, closedController.signal]),
      log: logConnectorEventToStderr,
      connectedFields: {},
      createQueue: ({ sendDone }) =>
        createWakeQueue({
          sendDone,
          runWake: ({ message }) => server.notification(buildChannelNotification({ message })),
        }),
    });
  } finally {
    await server.close();
  }
}
