import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  CHANNEL_FORWARDED_PREFIX,
  CONNECTOR_PATH_SUFFIX,
  ConnectorFrameType,
  ConnectorLogEvent,
  MessageKind,
  SECOND_MS,
} from '@zapbip/types';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { CONTAINER_HOST, OWNER_SENDER, SECRET_PREFIX } from '../../../../scripts/e2e/clients/constants';
import {
  type Container,
  containerExitCode,
  containerLogs,
  removeContainer,
  restartStoppedContainer,
  stopContainer,
} from '../../../../scripts/e2e/clients/container';
import { type FakeModel, replyTo, startFakeModel } from '../../../../scripts/e2e/clients/fake-model';
import { startHermesClient } from '../../../../scripts/e2e/clients/hermes-client';
import { buildOpenClawImage, startOpenClawClient } from '../../../../scripts/e2e/clients/openclaw-client';
import { startTlsFront, type TlsFront } from '../../../../scripts/e2e/clients/tls-front';
import type { ScreenEntry } from '../../src/contract/account-inbox-rpc';
import { McpToolName } from '../../src/contract/tool-definitions';
import { type IsolatedStack, startIsolatedStack } from './claude-code-stack';
import type { StackContext, WakeAccount } from './global-setup';
import { callTool, mcpUrl } from './stack';

const isolated = vi.hoisted(() => ({ context: null as StackContext | null }));

vi.mock('vitest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vitest')>()),
  inject: () => isolated.context,
}));

const CLIENTS_E2E_FLAG = 'ZAPBIP_E2E_CLIENTS';
const isEnabled = process.env[CLIENTS_E2E_FLAG] === '1';
const SETUP_TIMEOUT_MS = 600 * SECOND_MS;
const TEST_TIMEOUT_MS = 180 * SECOND_MS;
const ATTACH_TIMEOUT_MS = 120 * SECOND_MS;
const REPLY_TIMEOUT_MS = 90 * SECOND_MS;
const POLL_INTERVAL_MS = 500;
const SETTLE_WINDOW_MS = 8 * SECOND_MS;
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const CLEAN_SHUTDOWN_LIMIT_MS = 5 * SECOND_MS;
const CLEAN_EXIT_CODE = 0;
const MCP_CLIENT_NAME = 'zapbip-e2e-clients';
const MCP_CLIENT_VERSION = '0.0.0';
const HERMES_PLATFORM_CONNECTED_LINE = '✓ zapbip connected';
const HERMES_BOOT_TIMEOUT_MS = 90 * SECOND_MS;

enum ClientProduct {
  OpenClaw = 'openclaw',
  Hermes = 'hermes',
}

type RunningClient = { container: Container; account: WakeAccount };
type SocketMessage = { messageId: string; text: string };
type ConnectorFrame = { type: ConnectorFrameType; messages: SocketMessage[] };

let workDirectory: string;
let isolatedStack: IsolatedStack;
let fakeModel: FakeModel;
let tlsFront: TlsFront;
let runIndex = 0;
let testContainers: Container[] = [];

function connectionLinkOf(input: { account: WakeAccount }): string {
  return `https://${CONTAINER_HOST}:${tlsFront.port}/c/${input.account.secret}/mcp`;
}

function ownerUrl(input: { account: WakeAccount; path: string }): string {
  return `${isolated.context?.origin}/dev/owner/${input.account.phone}${input.path}`;
}

async function connectAccountAgent(input: { account: WakeAccount }): Promise<Client> {
  const client = new Client({ name: MCP_CLIENT_NAME, version: MCP_CLIENT_VERSION });
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl({ secret: input.account.secret }))));
  return client;
}

async function postOwner(input: { account: WakeAccount; body: Record<string, unknown> }): Promise<void> {
  const response = await fetch(ownerUrl({ account: input.account, path: '/messages' }), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input.body),
  });
  if (!response.ok) throw new Error(`owner simulator answered ${response.status}`);
}

function postOwnerText(input: { account: WakeAccount; text: string; forwarded: boolean }): Promise<void> {
  return postOwner({
    account: input.account,
    body: { kind: MessageKind.Text, text: `@${input.account.agent} ${input.text}`, reply_to: null, forwarded: input.forwarded },
  });
}

async function readScreen(input: { account: WakeAccount }): Promise<ScreenEntry[]> {
  const response = await fetch(ownerUrl({ account: input.account, path: '/screen' }));
  return ((await response.json()) as { entries: ScreenEntry[] }).entries;
}

async function awaitScreenText(input: { account: WakeAccount; text: string }): Promise<ScreenEntry> {
  return vi
    .waitFor(
      async () => {
        const entry = (await readScreen(input)).find((candidate) => candidate.text.includes(input.text));
        if (!entry) throw new Error(`the owner screen does not show ${input.text} yet`);
        return entry;
      },
      { timeout: REPLY_TIMEOUT_MS, interval: POLL_INTERVAL_MS },
    )
    .catch(async (error: Error) => {
      throw new Error(`${error.message}\n${await diagnosisOf()}`);
    });
}

async function diagnosisOf(): Promise<string> {
  const logs = await Promise.all(testContainers.map((container) => containerLogs({ container })));
  const modelCalls = fakeModel.requests.map((entry) => `${entry.url} ${entry.userText.slice(-700)}`);
  const serverLog = (await readFile(String(isolated.context?.logFile), 'utf8')).split('\n').slice(-40).join('\n');
  return `server log:\n${serverLog}\nmodel calls:\n${modelCalls.join('\n')}\ncontainer logs:\n${logs.map((log) => log.slice(-3_000)).join('\n---\n')}`;
}

async function awaitLog(input: { container: Container; pattern: string | RegExp; timeoutMs: number }): Promise<void> {
  await vi.waitFor(
    async () => {
      const logs = await containerLogs({ container: input.container });
      const isPresent = typeof input.pattern === 'string' ? logs.includes(input.pattern) : input.pattern.test(logs);
      if (!isPresent) throw new Error(`the container log does not show ${input.pattern} yet:\n${logs.slice(-4_000)}`);
    },
    { timeout: input.timeoutMs, interval: POLL_INTERVAL_MS },
  );
}

async function startUnattachedHermes(input: { accountIndex: number }): Promise<RunningClient> {
  const account = isolated.context?.wakeAccounts[input.accountIndex];
  if (!account) throw new Error(`no seeded account at ${input.accountIndex}`);
  runIndex += 1;
  const container = await startHermesClient({
    name: `zapbip-e2e-${ClientProduct.Hermes}-${process.pid}-${runIndex}`,
    directory: workDirectory,
    connectionLink: connectionLinkOf({ account }),
    fakeModelPort: fakeModel.port,
    certificateFile: tlsFront.certificateFile,
    allowedUsers: OWNER_SENDER,
  });
  testContainers.push(container);
  return { container, account };
}

async function startClient(input: { product: ClientProduct; accountIndex: number; allowedUsers: string }): Promise<RunningClient> {
  const account = isolated.context?.wakeAccounts[input.accountIndex];
  if (!account) throw new Error(`no seeded account at ${input.accountIndex}`);
  runIndex += 1;
  const name = `zapbip-e2e-${input.product}-${process.pid}-${runIndex}`;
  const common = {
    name,
    directory: workDirectory,
    connectionLink: connectionLinkOf({ account }),
    fakeModelPort: fakeModel.port,
    certificateFile: tlsFront.certificateFile,
  };
  const container =
    input.product === ClientProduct.OpenClaw
      ? await startOpenClawClient(common)
      : await startHermesClient({ ...common, allowedUsers: input.allowedUsers });
  testContainers.push(container);
  await awaitLog({ container, pattern: ConnectorLogEvent.ConnectorConnected, timeoutMs: ATTACH_TIMEOUT_MS });
  return { container, account };
}

describe.skipIf(!isEnabled)('hermes and openclaw plugins against the development stack', () => {
  beforeAll(async () => {
    workDirectory = await mkdtemp(join(tmpdir(), 'zapbip-e2e-clients-'));
    isolatedStack = await startIsolatedStack();
    isolated.context = isolatedStack.context;
    fakeModel = await startFakeModel();
    tlsFront = await startTlsFront({ targetPort: Number(new URL(isolatedStack.context.origin).port), directory: workDirectory });
    await buildOpenClawImage({ directory: workDirectory });
  }, SETUP_TIMEOUT_MS);

  afterEach(async () => {
    await Promise.all(testContainers.map((container) => removeContainer({ container })));
    testContainers = [];
  });

  afterAll(async () => {
    await fakeModel?.close();
    await tlsFront?.close();
    await isolatedStack?.stop();
    if (workDirectory) await rm(workDirectory, { recursive: true, force: true });
  });

  test(
    'Hermes install layout: the plugins directory alone makes the platform load and connect',
    async () => {
      const client = await startUnattachedHermes({ accountIndex: 0 });
      await awaitLog({ container: client.container, pattern: HERMES_PLATFORM_CONNECTED_LINE, timeoutMs: HERMES_BOOT_TIMEOUT_MS });
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E1 OpenClaw: the owner message reaches the agent and the reply reaches the owner',
    async () => {
      const client = await startClient({ product: ClientProduct.OpenClaw, accountIndex: 0, allowedUsers: OWNER_SENDER });
      await postOwnerText({ account: client.account, text: 'ping-e1', forwarded: false });
      await awaitScreenText({ account: client.account, text: replyTo({ token: 'ping-e1' }) });
      expect(fakeModel.requestsMentioning({ text: 'ping-e1' }).length).toBeGreaterThan(0);
      expect(await containerLogs({ container: client.container })).not.toContain(SECRET_PREFIX);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E2 Hermes: the platform is enabled by the environment alone and the reply reaches the owner',
    async () => {
      const client = await startClient({ product: ClientProduct.Hermes, accountIndex: 1, allowedUsers: OWNER_SENDER });
      await postOwnerText({ account: client.account, text: 'ping-e2', forwarded: false });
      await awaitScreenText({ account: client.account, text: replyTo({ token: 'ping-e2' }) });
      expect(await containerLogs({ container: client.container })).not.toContain(SECRET_PREFIX);
    },
    TEST_TIMEOUT_MS,
  );

  test.each([ClientProduct.OpenClaw, ClientProduct.Hermes])(
    'forwarded %s: the agent sees the forwarded prefix before the text',
    async (product) => {
      const client = await startClient({ product, accountIndex: 2, allowedUsers: OWNER_SENDER });
      const token = `ping-forwarded-${product}`;
      await postOwnerText({ account: client.account, text: token, forwarded: true });
      await awaitScreenText({ account: client.account, text: replyTo({ token }) });
      const [request] = fakeModel.requestsMentioning({ text: token });
      expect(request?.userText).toContain(CHANNEL_FORWARDED_PREFIX);
      expect(request?.userText).toContain(token);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'forwarded hermes: a slash command in a forwarded message reaches the model as prefixed text, not as a command',
    async () => {
      const client = await startClient({ product: ClientProduct.Hermes, accountIndex: 3, allowedUsers: OWNER_SENDER });
      const token = 'ping-command-hermes';
      await postOwnerText({ account: client.account, text: `/status ${token}`, forwarded: true });
      await awaitScreenText({ account: client.account, text: replyTo({ token }) });
      const [request] = fakeModel.requestsMentioning({ text: token });
      expect(request?.userText).toContain(`${CHANNEL_FORWARDED_PREFIX}\n/status ${token}`);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'forwarded openclaw: a slash command in a forwarded message reaches the model as prefixed text, not as a command',
    async () => {
      const client = await startClient({ product: ClientProduct.OpenClaw, accountIndex: 3, allowedUsers: OWNER_SENDER });
      const token = 'ping-command-openclaw';
      await postOwnerText({ account: client.account, text: `/status ${token}`, forwarded: true });
      await awaitScreenText({ account: client.account, text: replyTo({ token }) });
      const [request] = fakeModel.requestsMentioning({ text: token });
      expect(request?.userText).toContain(`${CHANNEL_FORWARDED_PREFIX} /status ${token}`);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E3 OpenClaw restart while idle: the message sent while it was down is handed off once',
    async () => {
      const client = await startClient({ product: ClientProduct.OpenClaw, accountIndex: 3, allowedUsers: OWNER_SENDER });
      await stopContainer({ container: client.container });
      await postOwnerText({ account: client.account, text: 'ping-e3', forwarded: false });
      await restartStoppedContainer({ container: client.container });
      await awaitScreenText({ account: client.account, text: replyTo({ token: 'ping-e3' }) });
      await delay(SETTLE_WINDOW_MS);
      const replies = (await readScreen({ account: client.account })).filter((entry) => entry.text.includes(replyTo({ token: 'ping-e3' })));
      expect(replies).toHaveLength(1);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E4 OpenClaw replacement: the older plugin is told it was replaced and exits cleanly, the newer one answers once',
    async () => {
      const first = await startClient({ product: ClientProduct.OpenClaw, accountIndex: 4, allowedUsers: OWNER_SENDER });
      const second = await startClient({ product: ClientProduct.OpenClaw, accountIndex: 4, allowedUsers: OWNER_SENDER });
      await awaitLog({ container: first.container, pattern: ConnectorLogEvent.ConnectorReplaced, timeoutMs: ATTACH_TIMEOUT_MS });
      await postOwnerText({ account: second.account, text: 'ping-e4', forwarded: false });
      await awaitScreenText({ account: second.account, text: replyTo({ token: 'ping-e4' }) });
      await delay(SETTLE_WINDOW_MS);
      const replies = (await readScreen({ account: second.account })).filter((entry) => entry.text.includes(replyTo({ token: 'ping-e4' })));
      expect(replies).toHaveLength(1);
      expect(await containerExitCode({ container: first.container })).toBe(CLEAN_EXIT_CODE);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E7 Hermes: an owner outside ZAPBIP_ALLOWED_USERS is refused and the model is never called',
    async () => {
      const client = await startClient({ product: ClientProduct.Hermes, accountIndex: 0, allowedUsers: 'someone-else' });
      await postOwnerText({ account: client.account, text: 'ping-e7', forwarded: false });
      await delay(SETTLE_WINDOW_MS);
      expect(fakeModel.requestsMentioning({ text: 'ping-e7' })).toHaveLength(0);
      const replies = (await readScreen({ account: client.account })).filter((entry) => entry.text.includes(replyTo({ token: 'ping-e7' })));
      expect(replies).toHaveLength(0);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'X1 socket contract: an attached plugin socket receives the owner message and a done frame clears it',
    async () => {
      const account = isolated.context?.wakeAccounts[0];
      if (!account) throw new Error('no seeded account at 0');
      const frames: ConnectorFrame[] = [];
      const socket = new WebSocket(`${isolated.context?.origin.replace('http', 'ws')}/c/${account.secret}${CONNECTOR_PATH_SUFFIX}`);
      socket.addEventListener('message', (event) => frames.push(JSON.parse(String(event.data)) as ConnectorFrame));
      await vi.waitFor(() => expect(frames.some((frame) => frame.type === ConnectorFrameType.Hello)).toBe(true), {
        timeout: ATTACH_TIMEOUT_MS,
        interval: POLL_INTERVAL_MS,
      });
      await postOwnerText({ account, text: 'ping-x1', forwarded: false });
      const messagesFrame = await vi.waitFor(
        () => {
          const found = frames.find((frame) => frame.type === ConnectorFrameType.Messages);
          if (!found) throw new Error('no messages frame yet');
          return found;
        },
        { timeout: REPLY_TIMEOUT_MS, interval: POLL_INTERVAL_MS },
      );
      const [message] = messagesFrame.messages;
      expect(message?.text).toBe('ping-x1');
      socket.send(JSON.stringify({ type: ConnectorFrameType.Done, messageId: message?.messageId }));
      const agent = await connectAccountAgent({ account });
      const inbox = await callTool({ client: agent, name: McpToolName.CheckInbox, arguments: {} });
      expect(inbox.text).not.toContain('ping-x1');
      socket.close();
      await agent.close();
    },
    TEST_TIMEOUT_MS,
  );

  test.each([ClientProduct.OpenClaw, ClientProduct.Hermes])(
    'E11%s clean shutdown: SIGTERM ends the container with exit code 0 within the limit',
    async (product) => {
      const client = await startClient({ product, accountIndex: 1, allowedUsers: OWNER_SENDER });
      const stoppedAt = Date.now();
      await stopContainer({ container: client.container });
      expect(Date.now() - stoppedAt).toBeLessThan(CLEAN_SHUTDOWN_LIMIT_MS);
      expect(await containerExitCode({ container: client.container })).toBe(CLEAN_EXIT_CODE);
    },
    TEST_TIMEOUT_MS,
  );
});
