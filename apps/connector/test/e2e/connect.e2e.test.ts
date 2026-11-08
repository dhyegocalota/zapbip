import { type ChildProcess, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CONNECTOR_RUNTIMES, ConnectorClient } from '@zapbip/agents/connector';
import { CHANNEL_NOTIFICATION_METHOD, CONNECTION_URL_VARIABLE, ConnectorLogEvent } from '@zapbip/types';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createFakeClients, runAt, type FakeClientBehavior, type FakeClients } from '../support/fake-client-binary';
import { startStack, type Stack } from './support/stack';

const CLI_BUNDLE = fileURLToPath(new URL('../../dist/cli.js', import.meta.url));
const SUBJECT_CLIENT = Object.values(ConnectorClient)[0] as ConnectorClient;
const SESSION_ID = '0b1f6c2e-5d7a-4c3b-9e8f-1a2b3c4d5e6f';
const CONNECT_AGENT = 'ana';
const LISTEN_AGENT = 'bia';
const CHANNEL_AGENT = 'caio';
const SIGNAL_AGENT = 'duda';
const PROMPT_EXIT_MS = 2_000;
const OWNER_TEXT = 'Oi';
const FAKE_REPLY = `FAKE-REPLY ${OWNER_TEXT}`;
const CALLS_MCP_VARIABLE = 'FAKE_CLIENT_CALLS_MCP';
const ZAPBIP_URL_VARIABLE = 'FAKE_CLIENT_ZAPBIP_URL';
const RUNTIME_AGENT_PREFIX = 'runtime';
const FIRST_LETTER_CODE = 97;
const RUNTIME_AGENTS = Object.values(ConnectorClient).map((client, index) => ({
  client,
  agent: `${RUNTIME_AGENT_PREFIX}${String.fromCharCode(FIRST_LETTER_CODE + index)}`,
}));
const DOWN_AGENT = 'fabio';
const ORDER_AGENT = 'gil';
const BURST_AGENT = 'hana';
const BURST_RUN_MS = 1_500;
const ABNORMAL_CLOSE_CODE_TEXT = '1006';
const RUNTIME_TEXT = 'Oi runtime';
const SESSION_MODIFIED_SECONDS = 1_700_000_000;
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

  function startCli(input: { agent: string; arguments: string[]; behavior?: FakeClientBehavior }): RunningCli {
    const { connectionUrl } = agentOf({ agent: input.agent });
    const child = spawn(process.execPath, [CLI_BUNDLE, ...input.arguments], {
      env: {
        ...inheritedEnvironment(),
        ...fakeClients.environment({ behavior: input.behavior === undefined ? {} : input.behavior }),
        [CALLS_MCP_VARIABLE]: '1',
        [ZAPBIP_URL_VARIABLE]: connectionUrl,
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
    stack = await startStack({
      agents: [
        CONNECT_AGENT,
        LISTEN_AGENT,
        CHANNEL_AGENT,
        SIGNAL_AGENT,
        ...RUNTIME_AGENTS.map((runtimeAgent) => runtimeAgent.agent),
        DOWN_AGENT,
        ORDER_AGENT,
        BURST_AGENT,
      ],
    });
  }, SUITE_TIMEOUT_MS);

  afterAll(async () => {
    await stack.stop();
  });

  beforeEach(async () => {
    started = [];
    clients = [];
    fakeClients = await createFakeClients();
    await fakeClients.writeSession({ client: SUBJECT_CLIENT, sessionId: SESSION_ID });
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
        arguments: ['connect', '--client', SUBJECT_CLIENT, '--cwd', fakeClients.workingDirectory],
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

  it.each(RUNTIME_AGENTS)(
    'connect wakes a $client session with the prompt on standard input and the reply reaches the owner screen',
    async ({ client, agent }) => {
      const text = `${RUNTIME_TEXT} ${client}`;
      await fakeClients.writeSession({ client, sessionId: SESSION_ID, modifiedAtSeconds: SESSION_MODIFIED_SECONDS });
      const connector = startCli({
        agent,
        arguments: ['connect', '--client', client, '--cwd', fakeClients.workingDirectory],
      });
      await connector.waitForEvent({ event: ConnectorLogEvent.ConnectorConnected });
      await stack.postOwnerText({ text: `@${agent} ${text}` });

      await vi.waitFor(async () => expect(await screenTexts()).toContain(`FAKE-REPLY ${text}`), { timeout: SUITE_TIMEOUT_MS });
      const runs = await fakeClients.readRuns();
      expect(runAt({ runs, index: 0 }).clientName).toBe(CONNECTOR_RUNTIMES[client].binaryName);
      expect(runAt({ runs, index: 0 }).argv).toContain(SESSION_ID);
      expect(runAt({ runs, index: 0 }).stdin).toContain(text);
    },
    SUITE_TIMEOUT_MS,
  );

  it(
    'a message sent while the connector is down is woken once when it connects',
    async () => {
      const downText = 'sent while down';
      const connectArguments = ['connect', '--client', SUBJECT_CLIENT, '--cwd', fakeClients.workingDirectory];
      const firstConnector = startCli({ agent: DOWN_AGENT, arguments: connectArguments });
      await firstConnector.waitForEvent({ event: ConnectorLogEvent.ConnectorConnected });
      const exited = new Promise((resolve) => firstConnector.child.on('exit', resolve));
      firstConnector.child.kill('SIGTERM');
      await exited;
      await stack.postOwnerText({ text: `@${DOWN_AGENT} ${downText}` });
      const connector = startCli({ agent: DOWN_AGENT, arguments: connectArguments });
      await connector.waitForEvent({ event: ConnectorLogEvent.ConnectorConnected });

      await vi.waitFor(async () => expect(await screenTexts()).toContain(`FAKE-REPLY ${downText}`), { timeout: SUITE_TIMEOUT_MS });
      await connector.waitForEvent({ event: ConnectorLogEvent.WakeFinished });
      const replies = (await screenTexts()).filter((text) => text === `FAKE-REPLY ${downText}`);
      expect(replies).toHaveLength(1);
      expect(await fakeClients.readRuns()).toHaveLength(1);
    },
    SUITE_TIMEOUT_MS,
  );

  it(
    'messages that arrive while a wake runs are woken one after the other in order',
    async () => {
      const connector = startCli({
        agent: BURST_AGENT,
        arguments: ['connect', '--client', SUBJECT_CLIENT, '--cwd', fakeClients.workingDirectory],
        behavior: { runMs: BURST_RUN_MS },
      });
      await connector.waitForEvent({ event: ConnectorLogEvent.ConnectorConnected });
      await stack.postOwnerText({ text: `@${BURST_AGENT} b1` });
      await connector.waitForEvent({ event: ConnectorLogEvent.WakeStarted });
      await stack.postOwnerText({ text: `@${BURST_AGENT} b2` });
      await stack.postOwnerText({ text: `@${BURST_AGENT} b3` });

      await vi.waitFor(async () => expect(await screenTexts()).toContain('FAKE-REPLY b3'), { timeout: SUITE_TIMEOUT_MS });
      const texts = await screenTexts();
      const positions = ['b1', 'b2', 'b3'].map((text) => texts.indexOf(`FAKE-REPLY ${text}`));
      expect(positions).toEqual([...positions].sort((first, second) => first - second));
      expect(positions.every((position) => position >= 0)).toBe(true);
      const runs = await fakeClients.readRuns();
      expect(runs).toHaveLength(3);
      expect(runAt({ runs, index: 1 }).startedAt).toBeGreaterThanOrEqual(runAt({ runs, index: 0 }).endedAt as number);
      expect(runAt({ runs, index: 2 }).startedAt).toBeGreaterThanOrEqual(runAt({ runs, index: 1 }).endedAt as number);
    },
    SUITE_TIMEOUT_MS,
  );

  it(
    'two messages in a row are both woken in order',
    async () => {
      const connector = startCli({
        agent: ORDER_AGENT,
        arguments: ['connect', '--client', SUBJECT_CLIENT, '--cwd', fakeClients.workingDirectory],
      });
      await connector.waitForEvent({ event: ConnectorLogEvent.ConnectorConnected });
      await stack.postOwnerText({ text: `@${ORDER_AGENT} first` });
      await stack.postOwnerText({ text: `@${ORDER_AGENT} second` });

      await vi.waitFor(async () => expect(await screenTexts()).toContain('FAKE-REPLY second'), { timeout: SUITE_TIMEOUT_MS });
      const texts = await screenTexts();
      expect(texts.indexOf('FAKE-REPLY first')).toBeGreaterThanOrEqual(0);
      expect(texts.indexOf('FAKE-REPLY first')).toBeLessThan(texts.indexOf('FAKE-REPLY second'));
      const runs = await fakeClients.readRuns();
      expect(runs).toHaveLength(2);
      expect(runAt({ runs, index: 0 }).stdin).toContain('first');
      expect(runAt({ runs, index: 1 }).stdin).toContain('second');
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
        arguments: ['connect', '--client', SUBJECT_CLIENT, '--cwd', fakeClients.workingDirectory],
      });
      await connector.waitForEvent({ event: ConnectorLogEvent.ConnectorConnected });
      const exited = new Promise<number | null>((resolve) => connector.child.on('exit', (code) => resolve(code)));
      const signalledAt = Date.now();
      connector.child.kill(signal);

      expect(await exited).toBe(0);
      expect(Date.now() - signalledAt).toBeLessThan(PROMPT_EXIT_MS);
      expect(connector.output()).not.toContain(ABNORMAL_CLOSE_CODE_TEXT);
    },
    SUITE_TIMEOUT_MS,
  );
});
