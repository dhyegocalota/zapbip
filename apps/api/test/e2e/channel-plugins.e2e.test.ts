import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AGENT_PLUGINS, PluginRegistry } from '@zapbip/agents/plugins';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  CHANNEL_FORWARDED_PREFIX,
  CHANNEL_HANDOFF_NO_TEXT_BY_KIND,
  CONNECTOR_PATH_SUFFIX,
  ConnectorFrameType,
  ConnectorLogEvent,
  MessageKind,
  ReplyStatus,
  SECOND_MS,
  WakeMode,
} from '@zapbip/types';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { CONTAINER_HOST, OWNER_SENDER, SECRET_PREFIX } from '../../../../scripts/e2e/clients/constants';
import {
  type Container,
  containerExitCode,
  containerLogs,
  isContainerRunning,
  removeContainer,
  restartStoppedContainer,
  stopContainer,
} from '../../../../scripts/e2e/clients/container';
import { type FakeModel, replyTo, startFakeModel } from '../../../../scripts/e2e/clients/fake-model';
import type { PluginEndToEndModule } from '../../../../scripts/e2e/clients/plugin-client';
import { startTlsFront, type TlsFront } from '../../../../scripts/e2e/clients/tls-front';
import type { ScreenEntry } from '../../src/contract/account-inbox-rpc';
import { McpToolName } from '../../src/contract/tool-definitions';
import { type IsolatedStack, startIsolatedStack } from './isolated-stack';
import type { StackContext, WakeAccount } from './global-setup';
import { callTool, mcpUrl } from './stack';

const isolated = vi.hoisted(() => ({ context: null as StackContext | null }));

vi.mock('vitest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vitest')>()),
  inject: () => isolated.context,
}));

const REPOSITORY_ROOT = join(import.meta.dirname, '..', '..', '..', '..');
const CLIENTS_E2E_FLAG = 'ZAPBIP_E2E_CLIENTS';
const isEnabled = process.env[CLIENTS_E2E_FLAG] === '1';
const SETUP_TIMEOUT_MS = 600 * SECOND_MS;
const TEST_TIMEOUT_MS = 180 * SECOND_MS;
const ATTACH_TIMEOUT_MS = 120 * SECOND_MS;
const REPLY_TIMEOUT_MS = 90 * SECOND_MS;
const POLL_INTERVAL_MS = 500;
const SETTLE_WINDOW_MS = 8 * SECOND_MS;
const UNKNOWN_SECRET_LENGTH = 43;
const RESTART_BACKOFF_WINDOW_MS = 20 * SECOND_MS;
const WHEEL_MCP_FAILURE_LINE = "Failed to connect to MCP server 'zapbip'";
const NPM_AUTO_RESTART_LINE = 'auto-restart attempt';
const NPM_AUTO_RESTART_SKIPPED_LINE = 'auto-restart skipped, terminal disconnect';
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const CLEAN_SHUTDOWN_LIMIT_MS = 5 * SECOND_MS;
const CLEAN_EXIT_CODE = 0;
const MCP_CLIENT_NAME = 'zapbip-e2e-clients';
const MCP_CLIENT_VERSION = '0.0.0';
const WHEEL_PLATFORM_CONNECTED_LINE = '✓ zapbip connected';
const WHEEL_BOOT_TIMEOUT_MS = 90 * SECOND_MS;

type RunningClient = { container: Container; account: WakeAccount };
type SocketMessage = { messageId: string; text: string };
type ConnectorFrame =
  { type: ConnectorFrameType.Hello; previousWakeMode: string } | { type: ConnectorFrameType.Messages; messages: SocketMessage[] };

let workDirectory: string;
let isolatedStack: IsolatedStack;
let fakeModel: FakeModel;
let tlsFront: TlsFront;
let runIndex = 0;
let testContainers: Container[] = [];
const endToEndModules = new Map<string, PluginEndToEndModule>();

function endToEndModuleOf(input: { id: string }): PluginEndToEndModule {
  const endToEndModule = endToEndModules.get(input.id);
  if (!endToEndModule) throw new Error(`no end-to-end module loaded for ${input.id}`);
  return endToEndModule;
}
const pluginIdsOf = (input: { registry: PluginRegistry }): string[] =>
  Object.entries(AGENT_PLUGINS)
    .filter(([, plugin]) => plugin.registry === input.registry)
    .map(([id]) => id);
const [WHEEL_PLUGIN] = pluginIdsOf({ registry: PluginRegistry.SelfHostedWheel }) as [string];
const [NPM_PLUGIN] = pluginIdsOf({ registry: PluginRegistry.Npm }) as [string];

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

const WEBHOOK_URL = 'https://api2.cursor.sh/automations/webhook/abcdefgh12';
const WEBHOOK_TOKEN = 'grok-token-sixteen-chars';
const POLL_TICK_MS = 2 * SECOND_MS;
const REPLACED_CLOSE_CODE_VALUE = 4001;
const ASK_TIMEOUT_SECONDS = 2;
const ASK_WAIT_SECONDS = 30;
const DETACH_SETTLE_MS = 2 * SECOND_MS;
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
const PNG_TYPE = 'image/png';
const NPM_SOURCE_FOLDER = 'src';
const PLUGIN_SOURCE_DIRECTORIES = Object.values(AGENT_PLUGINS).map((plugin) =>
  join(
    REPOSITORY_ROOT,
    plugin.packageFolder,
    plugin.registry === PluginRegistry.Npm ? NPM_SOURCE_FOLDER : plugin.packageName.replaceAll('-', '_'),
  ),
);
const TOOL_RESULT_MARKER = 'check_inbox';
const LISTEN_COMMAND_PATTERN = /zapbip listen|['"]listen['"]/;

type AttachedSocket = { frames: ConnectorFrame[]; socket: WebSocket; closeCodes: number[] };

function attachSocket(input: { account: WakeAccount }): AttachedSocket {
  const frames: ConnectorFrame[] = [];
  const closeCodes: number[] = [];
  const socket = new WebSocket(`${isolated.context?.origin.replace('http', 'ws')}/c/${input.account.secret}${CONNECTOR_PATH_SUFFIX}`);
  socket.addEventListener('message', (event) => frames.push(JSON.parse(String(event.data)) as ConnectorFrame));
  socket.addEventListener('close', (event) => closeCodes.push(event.code));
  return { frames, socket, closeCodes };
}

function pushedMessages(input: { attached: AttachedSocket }): SocketMessage[] {
  return input.attached.frames.flatMap((frame) => (frame.type === ConnectorFrameType.Messages ? frame.messages : []));
}

function helloOf(input: { attached: AttachedSocket }): Promise<{ previousWakeMode: string }> {
  return vi.waitFor(
    () => {
      const found = input.attached.frames.find((frame) => frame.type === ConnectorFrameType.Hello);
      if (!found) throw new Error('no hello frame yet');
      return found;
    },
    { timeout: ATTACH_TIMEOUT_MS, interval: POLL_INTERVAL_MS },
  );
}

function messageFrameWith(input: { attached: AttachedSocket; text: string }): Promise<SocketMessage> {
  return vi.waitFor(
    () => {
      const found = pushedMessages(input).find((message) => message.text === input.text);
      if (!found) throw new Error(`no messages frame with ${input.text} yet`);
      return found;
    },
    { timeout: REPLY_TIMEOUT_MS, interval: POLL_INTERVAL_MS },
  );
}

async function setWebhookWake(input: { account: WakeAccount }): Promise<void> {
  const agent = await connectAccountAgent({ account: input.account });
  await callTool({
    client: agent,
    name: McpToolName.SetWake,
    arguments: { mode: WakeMode.Webhook, url: WEBHOOK_URL, token: WEBHOOK_TOKEN },
  });
  await agent.close();
  await fetch(ownerUrl({ account: input.account, path: `/agents/${input.account.agent}/wake/script` }), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ responses: [{ statusCode: 200, errorName: null, retryAfterMs: null }] }),
  });
}

async function clearWake(input: { account: WakeAccount }): Promise<void> {
  const agent = await connectAccountAgent({ account: input.account });
  await callTool({ client: agent, name: McpToolName.SetWake, arguments: { mode: WakeMode.None, url: null, token: null } });
  await agent.close();
}

async function modelReplyTo(input: { text: string }): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${fakeModel.port}/v1/chat/completions`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ model: 'fake-model', stream: false, messages: [{ role: 'user', content: input.text }] }),
  });
  const body = (await response.json()) as { choices: { message: { content: string } }[] };
  const [choice] = body.choices;
  if (!choice) throw new Error('the fake model answered without a choice');
  return choice.message.content;
}

async function pollInboxFor(input: { account: WakeAccount; text: string }): Promise<void> {
  const agent = await connectAccountAgent({ account: input.account });
  await vi.waitFor(
    async () => {
      const inbox = await callTool({ client: agent, name: McpToolName.CheckInbox, arguments: {} });
      const messages = inbox.structured?.messages as SocketMessage[];
      if (!messages.some((message) => message.text === input.text)) throw new Error(`check_inbox does not show ${input.text} yet`);
    },
    { timeout: REPLY_TIMEOUT_MS, interval: POLL_TICK_MS },
  );
  await callTool({ client: agent, name: McpToolName.SendMessage, arguments: { text: await modelReplyTo({ text: input.text }) } });
  await agent.close();
}

async function textsOnScreen(input: { account: WakeAccount }): Promise<string[]> {
  return (await readScreen(input)).map((entry) => entry.text);
}

async function loadEndToEndModules(): Promise<void> {
  await Promise.all(
    Object.entries(AGENT_PLUGINS).map(async ([id, plugin]) => {
      endToEndModules.set(id, (await import(join(REPOSITORY_ROOT, plugin.endToEndModule))) as PluginEndToEndModule);
    }),
  );
}

async function startUnattachedWheelPlugin(input: { accountIndex: number }): Promise<RunningClient> {
  const account = isolated.context?.wakeAccounts[input.accountIndex];
  if (!account) throw new Error(`no seeded account at ${input.accountIndex}`);
  runIndex += 1;
  const container = await endToEndModuleOf({ id: WHEEL_PLUGIN }).startPluginClient({
    name: `zapbip-e2e-${WHEEL_PLUGIN}-${process.pid}-${runIndex}`,
    directory: workDirectory,
    connectionLink: connectionLinkOf({ account }),
    fakeModelPort: fakeModel.port,
    certificateFile: tlsFront.certificateFile,
    allowedUsers: OWNER_SENDER,
    hasMcpServer: false,
  });
  testContainers.push(container);
  return { container, account };
}

async function startClient(input: {
  product: string;
  accountIndex: number;
  allowedUsers: string;
  hasMcpServer: boolean;
}): Promise<RunningClient> {
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
    hasMcpServer: input.hasMcpServer,
  };
  const container = await endToEndModuleOf({ id: input.product }).startPluginClient({ ...common, allowedUsers: input.allowedUsers });
  testContainers.push(container);
  await awaitLog({ container, pattern: ConnectorLogEvent.ConnectorConnected, timeoutMs: ATTACH_TIMEOUT_MS });
  return { container, account };
}

describe.skipIf(!isEnabled)('channel plugins against the development stack', () => {
  beforeAll(async () => {
    workDirectory = await mkdtemp(join(tmpdir(), 'zapbip-e2e-clients-'));
    isolatedStack = await startIsolatedStack();
    isolated.context = isolatedStack.context;
    fakeModel = await startFakeModel();
    tlsFront = await startTlsFront({ targetPort: Number(new URL(isolatedStack.context.origin).port), directory: workDirectory });
    await loadEndToEndModules();
    await [...endToEndModules.values()].reduce(
      (previous, endToEndModule) => previous.then(() => endToEndModule.buildPluginImage({ directory: workDirectory })),
      Promise.resolve(),
    );
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
    'Wheel plugin install layout: pip install of the package alone makes the platform load and connect',
    async () => {
      const client = await startUnattachedWheelPlugin({ accountIndex: 0 });
      await awaitLog({ container: client.container, pattern: WHEEL_PLATFORM_CONNECTED_LINE, timeoutMs: WHEEL_BOOT_TIMEOUT_MS });
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E1 npm plugin: the owner message reaches the agent and the reply reaches the owner',
    async () => {
      const client = await startClient({
        product: NPM_PLUGIN,
        accountIndex: 0,
        allowedUsers: OWNER_SENDER,
        hasMcpServer: false,
      });
      await postOwnerText({ account: client.account, text: 'ping-e1', forwarded: false });
      await awaitScreenText({ account: client.account, text: replyTo({ token: 'ping-e1' }) });
      expect(fakeModel.requestsMentioning({ text: 'ping-e1' }).length).toBeGreaterThan(0);
      expect(await containerLogs({ container: client.container })).not.toContain(SECRET_PREFIX);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E2 wheel plugin: the platform is enabled by the environment alone and the reply reaches the owner',
    async () => {
      const client = await startClient({ product: WHEEL_PLUGIN, accountIndex: 1, allowedUsers: OWNER_SENDER, hasMcpServer: false });
      await postOwnerText({ account: client.account, text: 'ping-e2', forwarded: false });
      await awaitScreenText({ account: client.account, text: replyTo({ token: 'ping-e2' }) });
      expect(await containerLogs({ container: client.container })).not.toContain(SECRET_PREFIX);
    },
    TEST_TIMEOUT_MS,
  );

  test.each(Object.keys(AGENT_PLUGINS))(
    'forwarded %s: the agent sees the forwarded prefix before the text',
    async (product) => {
      const client = await startClient({ product, accountIndex: 2, allowedUsers: OWNER_SENDER, hasMcpServer: false });
      const token = `ping-forwarded-${product}`;
      await postOwnerText({ account: client.account, text: token, forwarded: true });
      await awaitScreenText({ account: client.account, text: replyTo({ token }) });
      const [request] = fakeModel.requestsMentioning({ text: token });
      expect(request?.userText).toContain(CHANNEL_FORWARDED_PREFIX);
      expect(request?.userText).toContain(token);
    },
    TEST_TIMEOUT_MS,
  );

  test.each(Object.keys(AGENT_PLUGINS))(
    'MCP %s: the zapbip server from the documented configuration gives the agent check_inbox and the result reaches the model',
    async (product) => {
      const client = await startClient({ product, accountIndex: 2, allowedUsers: OWNER_SENDER, hasMcpServer: true });
      const token = `ping-tool-${product}`;
      await postOwnerText({ account: client.account, text: token, forwarded: false });
      await awaitScreenText({ account: client.account, text: replyTo({ token }) });
      const requests = fakeModel.requestsMentioning({ text: token });
      const toolResultTexts = requests.flatMap((request) => request.toolResultTexts);
      expect(toolResultTexts.length).toBeGreaterThan(0);
      expect(toolResultTexts.join(' ')).toContain(TOOL_RESULT_MARKER);
      expect(await containerLogs({ container: client.container })).not.toContain(SECRET_PREFIX);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E8 wheel plugin at DEBUG with a refused link and a configured MCP server: no log line holds the secret path',
    async () => {
      const unknownSecret = `${SECRET_PREFIX}${'x'.repeat(UNKNOWN_SECRET_LENGTH)}`;
      const container = await endToEndModuleOf({ id: WHEEL_PLUGIN }).startPluginClient({
        name: `zapbip-e2e-${WHEEL_PLUGIN}-${process.pid}-refused`,
        directory: workDirectory,
        connectionLink: `https://${CONTAINER_HOST}:${tlsFront.port}/c/${unknownSecret}/mcp`,
        fakeModelPort: fakeModel.port,
        certificateFile: tlsFront.certificateFile,
        allowedUsers: OWNER_SENDER,
        hasMcpServer: true,
      });
      testContainers.push(container);
      await awaitLog({ container, pattern: WHEEL_MCP_FAILURE_LINE, timeoutMs: WHEEL_BOOT_TIMEOUT_MS });
      await awaitLog({ container, pattern: ConnectorLogEvent.ConnectorClosed, timeoutMs: WHEEL_BOOT_TIMEOUT_MS });
      await delay(SETTLE_WINDOW_MS);
      const logs = await containerLogs({ container });
      expect(logs).toContain(WHEEL_MCP_FAILURE_LINE);
      expect(logs).not.toContain(SECRET_PREFIX);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'forwarded wheel plugin: a slash command in a forwarded message reaches the model as prefixed text, not as a command',
    async () => {
      const client = await startClient({ product: WHEEL_PLUGIN, accountIndex: 3, allowedUsers: OWNER_SENDER, hasMcpServer: false });
      const token = 'ping-command-wheel';
      await postOwnerText({ account: client.account, text: `/status ${token}`, forwarded: true });
      await awaitScreenText({ account: client.account, text: replyTo({ token }) });
      const [request] = fakeModel.requestsMentioning({ text: token });
      expect(request?.userText).toContain(`${CHANNEL_FORWARDED_PREFIX} /status ${token}`);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'forwarded npm plugin: a slash command in a forwarded message reaches the model as prefixed text, not as a command',
    async () => {
      const client = await startClient({
        product: NPM_PLUGIN,
        accountIndex: 3,
        allowedUsers: OWNER_SENDER,
        hasMcpServer: false,
      });
      const token = 'ping-command-npm';
      await postOwnerText({ account: client.account, text: `/status ${token}`, forwarded: true });
      await awaitScreenText({ account: client.account, text: replyTo({ token }) });
      const [request] = fakeModel.requestsMentioning({ text: token });
      expect(request?.userText).toContain(`${CHANNEL_FORWARDED_PREFIX} /status ${token}`);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E3 npm plugin restart while idle: the message sent while it was down is handed off once',
    async () => {
      const client = await startClient({
        product: NPM_PLUGIN,
        accountIndex: 3,
        allowedUsers: OWNER_SENDER,
        hasMcpServer: false,
      });
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
    'E4 npm plugin replacement: the older plugin is told it was replaced and stays up blocked without restarting, the newer one answers once',
    async () => {
      const first = await startClient({
        product: NPM_PLUGIN,
        accountIndex: 4,
        allowedUsers: OWNER_SENDER,
        hasMcpServer: false,
      });
      const second = await startClient({
        product: NPM_PLUGIN,
        accountIndex: 4,
        allowedUsers: OWNER_SENDER,
        hasMcpServer: false,
      });
      await awaitLog({ container: first.container, pattern: ConnectorLogEvent.ConnectorReplaced, timeoutMs: ATTACH_TIMEOUT_MS });
      await postOwnerText({ account: second.account, text: 'ping-e4', forwarded: false });
      await awaitScreenText({ account: second.account, text: replyTo({ token: 'ping-e4' }) });
      await delay(RESTART_BACKOFF_WINDOW_MS);
      const replies = (await readScreen({ account: second.account })).filter((entry) => entry.text.includes(replyTo({ token: 'ping-e4' })));
      expect(replies).toHaveLength(1);
      expect(fakeModel.requestsMentioning({ text: 'ping-e4' })).toHaveLength(1);
      const olderLogs = await containerLogs({ container: first.container });
      expect(olderLogs).toContain(NPM_AUTO_RESTART_SKIPPED_LINE);
      expect(olderLogs).not.toContain(NPM_AUTO_RESTART_LINE);
      expect(await isContainerRunning({ container: first.container })).toBe(true);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E7 wheel plugin: an owner outside ZAPBIP_ALLOWED_USERS is refused and the model is never called',
    async () => {
      const client = await startClient({
        product: WHEEL_PLUGIN,
        accountIndex: 0,
        allowedUsers: 'someone-else',
        hasMcpServer: false,
      });
      await postOwnerText({ account: client.account, text: 'ping-e7', forwarded: false });
      await delay(SETTLE_WINDOW_MS);
      expect(fakeModel.requestsMentioning({ text: 'ping-e7' })).toHaveLength(0);
      const replies = (await readScreen({ account: client.account })).filter((entry) => entry.text.includes(replyTo({ token: 'ping-e7' })));
      expect(replies).toHaveLength(0);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'X1 and X2 socket contract: an attached plugin socket receives the owner message and a done frame clears it',
    async () => {
      const account = isolated.context?.wakeAccounts[3];
      if (!account) throw new Error('no seeded account at 3');
      const attached = attachSocket({ account });
      await helloOf({ attached });
      await postOwnerText({ account, text: 'ping-x1', forwarded: false });
      const message = await messageFrameWith({ attached, text: 'ping-x1' });
      attached.socket.send(JSON.stringify({ type: ConnectorFrameType.Done, messageId: message.messageId }));
      const agent = await connectAccountAgent({ account });
      await vi.waitFor(
        async () => {
          const inbox = await callTool({ client: agent, name: McpToolName.CheckInbox, arguments: {} });
          expect(inbox.text).not.toContain('ping-x1');
        },
        { timeout: REPLY_TIMEOUT_MS, interval: POLL_INTERVAL_MS },
      );
      attached.socket.close();
      await agent.close();
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E5 fallback with the plugin down: a poll of check_inbox finds the message and the reply reaches the owner',
    async () => {
      const account = isolated.context?.wakeAccounts[0];
      if (!account) throw new Error('no seeded account at 0');
      await postOwnerText({ account, text: 'ping-e5', forwarded: false });
      await pollInboxFor({ account, text: 'ping-e5' });
      await awaitScreenText({ account, text: replyTo({ token: 'ping-e5' }) });
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E6 fallback restored after reattach: the restarted plugin takes the next message, not a poll',
    async () => {
      const client = await startClient({
        product: NPM_PLUGIN,
        accountIndex: 0,
        allowedUsers: OWNER_SENDER,
        hasMcpServer: false,
      });
      await postOwnerText({ account: client.account, text: 'ping-e6', forwarded: false });
      await awaitScreenText({ account: client.account, text: replyTo({ token: 'ping-e6' }) });
      await awaitLog({ container: client.container, pattern: ConnectorLogEvent.MessagesReceived, timeoutMs: REPLY_TIMEOUT_MS });
      expect(fakeModel.requestsMentioning({ text: 'ping-e6' }).length).toBeGreaterThan(0);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E9 media without caption: the agent receives the no-text sentence for an image and replies once',
    async () => {
      const client = await startClient({
        product: NPM_PLUGIN,
        accountIndex: 1,
        allowedUsers: OWNER_SENDER,
        hasMcpServer: false,
      });
      await postOwnerText({ account: client.account, text: 'ping-e9', forwarded: false });
      await awaitScreenText({ account: client.account, text: replyTo({ token: 'ping-e9' }) });
      const repliesBefore = (await textsOnScreen({ account: client.account })).length;
      await postOwner({
        account: client.account,
        body: { kind: MessageKind.Image, mime_type: PNG_TYPE, data_base64: PNG_BASE64, caption: null, reply_to: null, forwarded: false },
      });
      const sentence = CHANNEL_HANDOFF_NO_TEXT_BY_KIND[MessageKind.Image];
      await vi.waitFor(() => expect(fakeModel.requestsMentioning({ text: sentence }).length).toBeGreaterThan(0), {
        timeout: REPLY_TIMEOUT_MS,
        interval: POLL_INTERVAL_MS,
      });
      await delay(SETTLE_WINDOW_MS);
      expect((await textsOnScreen({ account: client.account })).length).toBe(repliesBefore + 1);
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'E10 choice reply: tapping a button of an ask that already timed out hands the selected title to the agent once',
    async () => {
      const client = await startClient({
        product: NPM_PLUGIN,
        accountIndex: 2,
        allowedUsers: OWNER_SENDER,
        hasMcpServer: false,
      });
      await postOwnerText({ account: client.account, text: 'ping-e10', forwarded: false });
      await awaitScreenText({ account: client.account, text: replyTo({ token: 'ping-e10' }) });
      const agent = await connectAccountAgent({ account: client.account });
      const asked = await callTool({
        client: agent,
        name: McpToolName.Ask,
        arguments: {
          question: 'which one',
          options: [
            { title: 'ping-e10-yes', description: null },
            { title: 'ping-e10-no', description: null },
          ],
          timeout_seconds: ASK_TIMEOUT_SECONDS,
        },
      });
      expect(asked.structured?.status).toBe(ReplyStatus.Pending);
      const history = await callTool({ client: agent, name: McpToolName.GetMessages, arguments: {} });
      const question = (
        history.structured?.history as { kind: MessageKind; choice: { options: { option_id: string; title: string }[] } | null }[]
      )
        .filter((message) => message.kind === MessageKind.Choice && message.choice !== null)
        .at(-1);
      const option = question?.choice?.options[0];
      if (!option) throw new Error('no option to tap');
      await postOwner({
        account: client.account,
        body: {
          kind: MessageKind.Choice,
          option_id: option.option_id,
          title: option.title,
          description: null,
          reply_to: null,
          forwarded: false,
        },
      });
      await awaitScreenText({ account: client.account, text: replyTo({ token: 'ping-e10-yes' }) });
      await delay(SETTLE_WINDOW_MS);
      expect(fakeModel.requestsMentioning({ text: 'ping-e10-yes' })).toHaveLength(1);
      await agent.close();
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'X3 a live waiter wins and the attached plugin socket is not pushed the message the waiter consumed',
    async () => {
      const account = isolated.context?.wakeAccounts[4];
      if (!account) throw new Error('no seeded account at 4');
      const attached = attachSocket({ account });
      await helloOf({ attached });
      const agent = await connectAccountAgent({ account });
      const asking = callTool({
        client: agent,
        name: McpToolName.WaitForReply,
        arguments: { question_id: null, timeout_seconds: ASK_WAIT_SECONDS },
      });
      await delay(SETTLE_WINDOW_MS / 2);
      await postOwnerText({ account, text: 'ping-x3', forwarded: false });
      const answered = await asking;
      expect(answered.text).toContain('ping-x3');
      await delay(SETTLE_WINDOW_MS / 2);
      const pushedTexts = pushedMessages({ attached }).map((message) => message.text);
      expect(pushedTexts).not.toContain('ping-x3');
      attached.socket.close();
      await agent.close();
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'X4 and X5 a stored webhook mode is recorded on attach and restored, not left at local, on detach',
    async () => {
      const account = isolated.context?.wakeAccounts[4];
      if (!account) throw new Error('no seeded account at 4');
      await setWebhookWake({ account });
      const attached = attachSocket({ account });
      const hello = await helloOf({ attached });
      expect(hello.previousWakeMode).toBe(WakeMode.Webhook);
      await postOwnerText({ account, text: 'ping-x4', forwarded: false });
      await messageFrameWith({ attached, text: 'ping-x4' });
      attached.socket.close();
      await vi.waitFor(() => expect(attached.closeCodes).toHaveLength(1), { timeout: ATTACH_TIMEOUT_MS, interval: POLL_INTERVAL_MS });
      await delay(DETACH_SETTLE_MS);
      const reattached = attachSocket({ account });
      expect((await helloOf({ attached: reattached })).previousWakeMode).toBe(WakeMode.Webhook);
      reattached.socket.close();
      await delay(DETACH_SETTLE_MS);
      await clearWake({ account });
    },
    TEST_TIMEOUT_MS,
  );

  test(
    'X6 a second plugin on the same connection closes the first with 4001 and receives the unread messages',
    async () => {
      const account = isolated.context?.wakeAccounts[4];
      if (!account) throw new Error('no seeded account at 4');
      const first = attachSocket({ account });
      await helloOf({ attached: first });
      const second = attachSocket({ account });
      await helloOf({ attached: second });
      await vi.waitFor(() => expect(first.closeCodes).toEqual([REPLACED_CLOSE_CODE_VALUE]), {
        timeout: ATTACH_TIMEOUT_MS,
        interval: POLL_INTERVAL_MS,
      });
      await postOwnerText({ account, text: 'ping-x6', forwarded: false });
      await messageFrameWith({ attached: second, text: 'ping-x6' });
      second.socket.close();
    },
    TEST_TIMEOUT_MS,
  );

  test('X7 neither plugin starts a zapbip listen process on the connection it holds', async () => {
    const sources = await Promise.all(
      PLUGIN_SOURCE_DIRECTORIES.map(async (directory) =>
        Promise.all(
          (await readdir(directory)).filter((name) => /\.(ts|py)$/.test(name)).map((name) => readFile(join(directory, name), 'utf8')),
        ),
      ),
    );
    sources.flat().forEach((source) => expect(source).not.toMatch(LISTEN_COMMAND_PATTERN));
  });

  test.each(Object.keys(AGENT_PLUGINS))(
    'E11%s clean shutdown: SIGTERM ends the container with exit code 0 within the limit',
    async (product) => {
      const client = await startClient({ product, accountIndex: 1, allowedUsers: OWNER_SENDER, hasMcpServer: false });
      const stoppedAt = Date.now();
      await stopContainer({ container: client.container });
      expect(Date.now() - stoppedAt).toBeLessThan(CLEAN_SHUTDOWN_LIMIT_MS);
      expect(await containerExitCode({ container: client.container })).toBe(CLEAN_EXIT_CODE);
    },
    TEST_TIMEOUT_MS,
  );
});
