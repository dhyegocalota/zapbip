import { type ChildProcess, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CHANNEL_NOTIFICATION_METHOD, CONNECTION_URL_VARIABLE, ConnectorClient, ConnectorLogEvent } from '@zapbip/types';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createFakeClients, runAt, type FakeClients } from '../support/fake-client-binary';
import { startStack, type Stack } from './support/stack';

const CLI_BUNDLE = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
const SESSION_ID = '0b1f6c2e-5d7a-4c3b-9e8f-1a2b3c4d5e6f';
const CONNECT_AGENT = 'ana';
const LISTEN_AGENT = 'bia';
const CHANNEL_AGENT = 'caio';
const SIGNAL_AGENT = 'duda';
const PROMPT_EXIT_MS = 2_000;
const OWNER_TEXT = 'Oi';
const FAKE_REPLY = `FAKE-REPLY ${OWNER_TEXT}`;
const MCP_CONFIG_VARIABLE = 'FAKE_CLIENT_MCP_CONFIG';
const DISABLE_TLS_VERIFICATION = { NODE_TLS_REJECT_UNAUTHORIZED: '0' };
const SUITE_TIMEOUT_MS = 120_000;
const ChannelNotificationSchema = z.object({
  method: z.literal(CHANNEL_NOTIFICATION_METHOD),
  params: z.object({ content: z.string(), meta: z.record(z.string(), z.string()) }),
});

type RunningCli = { child: ChildProcess; output: () => string; waitForEvent: (input: { event: ConnectorLogEvent }) => Promise<void> };

describe('the bundled connector against the local stack', () => {
  let stack: Stack;
  let fakeClients: FakeClients;
  let started: ChildProcess[];
  let clients: Client[];

  function inheritedEnvironment(): Record<string, string> {
    return Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
  }

  function startCli(input: { agent: string; arguments: string[] }): RunningCli {
    const { connectionUrl, mcpConfigFile } = agentOf({ agent: input.agent });
    const child = spawn(process.execPath, [CLI_BUNDLE, ...input.arguments], {
      env: {
        ...inheritedEnvironment(),
        ...fakeClients.environment({ behavior: {} }),
        [MCP_CONFIG_VARIABLE]: mcpConfigFile,
        [CONNECTION_URL_VARIABLE]: connectionUrl,
        ...DISABLE_TLS_VERIFICATION,
      },
      stdio: 'pipe',
    });
    started.push(child);
    let collected = '';
    child.stdout?.on('data', (chunk: Buffer) => (collected += chunk.toString()));
    child.stderr?.on('data', (chunk: Buffer) => (collected += chunk.toString()));
    return {
      child,
      output: () => collected,
      waitForEvent: ({ event }) => vi.waitFor(() => expect(collected).toContain(`"event":"${event}"`), { timeout: SUITE_TIMEOUT_MS }),
    };
  }

  function agentOf(input: { agent: string }) {
    const entry = stack.agents[input.agent];
    if (entry === undefined) throw new Error(`no seeded agent ${input.agent}`);
    return entry;
  }

  async function screenTexts(): Promise<string[]> {
    return (await stack.readScreen()).map((entry) => entry.text);
  }

  beforeAll(async () => {
    stack = await startStack({ agents: [CONNECT_AGENT, LISTEN_AGENT, CHANNEL_AGENT, SIGNAL_AGENT] });
  }, SUITE_TIMEOUT_MS);

  afterAll(async () => {
    await stack.stop();
  });

  beforeEach(async () => {
    started = [];
    clients = [];
    fakeClients = await createFakeClients();
    await fakeClients.writeClaudeSession({ sessionId: SESSION_ID });
  });

  afterEach(async () => {
    await Promise.all(clients.map((client) => client.close()));
    started.forEach((child) => child.kill('SIGKILL'));
    await fakeClients.cleanup();
  });

  it(
    'connect wakes the session and the reply reaches the owner screen',
    async () => {
      const connector = startCli({
        agent: CONNECT_AGENT,
        arguments: ['connect', '--client', ConnectorClient.ClaudeCode, '--cwd', fakeClients.workingDirectory],
      });
      await connector.waitForEvent({ event: ConnectorLogEvent.ConnectorConnected });
      await stack.postOwnerText({ text: `@${CONNECT_AGENT} ${OWNER_TEXT}` });

      await vi.waitFor(async () => expect(await screenTexts()).toContain(FAKE_REPLY), { timeout: SUITE_TIMEOUT_MS });
      const runs = await fakeClients.readRuns();
      expect(runAt({ runs, index: 0 }).argv).toContain(SESSION_ID);
      expect(connector.output()).not.toContain(agentOf({ agent: CONNECT_AGENT }).connectionUrl);
    },
    SUITE_TIMEOUT_MS,
  );

  it(
    'listen prints one JSON line for the owner message',
    async () => {
      const listener = startCli({ agent: LISTEN_AGENT, arguments: ['listen'] });
      await listener.waitForEvent({ event: ConnectorLogEvent.ConnectorConnected });
      await stack.postOwnerText({ text: `@${LISTEN_AGENT} ${OWNER_TEXT}` });

      await vi.waitFor(() => expect(listener.output()).toContain(`"text":"${OWNER_TEXT}"`), { timeout: SUITE_TIMEOUT_MS });
      const lines = listener
        .output()
        .split('\n')
        .filter((line) => line.startsWith('{"messageId"') && line.includes('"sender"'));
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0] as string)).toMatchObject({
        kind: 'text',
        sender: 'owner',
        verified: true,
        forwarded: false,
        text: OWNER_TEXT,
      });
    },
    SUITE_TIMEOUT_MS,
  );

  it(
    'channel emits one notification for the owner message',
    async () => {
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [CLI_BUNDLE, 'channel'],
        env: {
          ...inheritedEnvironment(),
          [CONNECTION_URL_VARIABLE]: agentOf({ agent: CHANNEL_AGENT }).connectionUrl,
          ...DISABLE_TLS_VERIFICATION,
        },
        stderr: 'pipe',
      });
      const notifications: z.infer<typeof ChannelNotificationSchema>['params'][] = [];
      const client = new Client({ name: 'connector-e2e', version: '1.0.0' });
      client.setNotificationHandler(ChannelNotificationSchema, ({ params }) => {
        notifications.push(params);
      });
      clients.push(client);
      let channelLog = '';
      transport.stderr?.on('data', (chunk: Buffer) => (channelLog += chunk.toString()));
      await client.connect(transport);
      await vi.waitFor(() => expect(channelLog).toContain(`"event":"${ConnectorLogEvent.ConnectorConnected}"`), {
        timeout: SUITE_TIMEOUT_MS,
      });
      await stack.postOwnerText({ text: `@${CHANNEL_AGENT} ${OWNER_TEXT}` });

      await vi.waitFor(() => expect(notifications).toHaveLength(1), { timeout: SUITE_TIMEOUT_MS });
      expect(notifications[0]).toEqual({ content: OWNER_TEXT, meta: { sender: 'owner', verified: 'true', forwarded: 'false' } });
    },
    SUITE_TIMEOUT_MS,
  );

  it.each(['SIGTERM', 'SIGINT'] as const)(
    'connect exits 0 within two seconds on %s',
    async (signal) => {
      const connector = startCli({
        agent: SIGNAL_AGENT,
        arguments: ['connect', '--client', ConnectorClient.ClaudeCode, '--cwd', fakeClients.workingDirectory],
      });
      await connector.waitForEvent({ event: ConnectorLogEvent.ConnectorConnected });
      const exited = new Promise<number | null>((resolve) => connector.child.on('exit', (code) => resolve(code)));
      const signalledAt = Date.now();
      connector.child.kill(signal);

      expect(await exited).toBe(0);
      expect(Date.now() - signalledAt).toBeLessThan(PROMPT_EXIT_MS);
    },
    SUITE_TIMEOUT_MS,
  );
});
