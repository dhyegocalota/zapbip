import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { WAKE_BACKOFF_BASE_MS, WAKE_COPY, WAKE_DEBOUNCE_MS, WAKE_SIGNAL_BODY, type RecordedWakeRequest } from '@zapbip/core';
import { DEFAULT_LOCALE, MessageKind, WakeCopyKey, WakeMode } from '@zapbip/types';
import { afterAll, describe, expect, test } from 'vitest';
import { McpToolName } from '../../src/contract/tool-definitions';
import type { ScreenEntry } from '../../src/contract/account-inbox-rpc';
import type { WakeAccount } from './global-setup';
import { callTool, mcpUrl, stack } from './stack';

const GROK_URL = 'https://api2.cursor.sh/automations/webhook/abcdefgh12';
const GROK_TOKEN = 'grok-token-sixteen-chars';
const ACCEPTED = { statusCode: 200, errorName: null, retryAfterMs: null };
const UNAVAILABLE = { statusCode: 503, errorName: null, retryAfterMs: null };
const UNAUTHORIZED = { statusCode: 401, errorName: null, retryAfterMs: null };
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const CLIENT_NAME = 'zapbip-e2e-wake';
const CLIENT_VERSION = '0.0.0';
const AGENT_REPLY = 'acordei e li sua mensagem';
const OWNER_BODY = 'oi, acorda';

const clients: Client[] = [];

function accountOf(input: { index: number }): WakeAccount {
  const account = stack().wakeAccounts[input.index];
  if (!account) throw new Error(`no wake account ${input.index}`);
  return account;
}

function ownerUrl(input: { account: WakeAccount; path: string }): string {
  return `${stack().origin}/dev/owner/${input.account.phone}${input.path}`;
}

async function connect(input: { account: WakeAccount }): Promise<Client> {
  const client = new Client({ name: CLIENT_NAME, version: CLIENT_VERSION });
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl({ secret: input.account.secret }))));
  clients.push(client);
  return client;
}

async function enableWake(input: { account: WakeAccount; responses: unknown[] }): Promise<Client> {
  const client = await connect(input);
  const result = await callTool({
    client,
    name: McpToolName.SetWake,
    arguments: { mode: WakeMode.Webhook, url: GROK_URL, token: GROK_TOKEN },
  });
  expect(result.isError).toBe(false);
  const script = await fetch(ownerUrl({ account: input.account, path: `/agents/${input.account.agent}/wake/script` }), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ responses: input.responses }),
  });
  expect(script.ok).toBe(true);
  return client;
}

async function ownerSays(input: { account: WakeAccount; text: string }): Promise<void> {
  const response = await fetch(ownerUrl({ account: input.account, path: '/messages' }), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ kind: MessageKind.Text, text: `@${input.account.agent} ${input.text}` }),
  });
  expect(response.ok).toBe(true);
}

async function advanceThenRun(input: { account: WakeAccount; advanceMs: number }): Promise<void> {
  const advance = await fetch(ownerUrl({ account: input.account, path: '/clock' }), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ advance_ms: input.advanceMs }),
  });
  expect(advance.ok).toBe(true);
  const run = await fetch(ownerUrl({ account: input.account, path: '/wake/run' }), { method: 'POST' });
  expect(run.ok).toBe(true);
}

async function recordedRequests(input: { account: WakeAccount }): Promise<RecordedWakeRequest[]> {
  const response = await fetch(ownerUrl({ account: input.account, path: `/agents/${input.account.agent}/wake/requests` }));
  return (await response.json()) as RecordedWakeRequest[];
}

async function screenOf(input: { account: WakeAccount }): Promise<ScreenEntry[]> {
  const response = await fetch(ownerUrl({ account: input.account, path: '/screen' }));
  return ((await response.json()) as { entries: ScreenEntry[] }).entries;
}

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

describe('webhook wake against wrangler dev', () => {
  test('WW-1 one owner message wakes its own agent once and leaves another account alone', async () => {
    const woken = accountOf({ index: 0 });
    const bystander = accountOf({ index: 1 });
    await enableWake({ account: woken, responses: [ACCEPTED] });
    await enableWake({ account: bystander, responses: [ACCEPTED] });
    await ownerSays({ account: woken, text: OWNER_BODY });
    await advanceThenRun({ account: woken, advanceMs: WAKE_DEBOUNCE_MS });
    const wokenRequests = await recordedRequests({ account: woken });
    expect(wokenRequests.map((request) => request.body)).toEqual([WAKE_SIGNAL_BODY]);
    expect(await recordedRequests({ account: bystander })).toEqual([]);
  });

  test('WW-2 after the wake the agent reads the inbox and its reply reaches the owner screen', async () => {
    const account = accountOf({ index: 2 });
    const agent = await enableWake({ account, responses: [ACCEPTED] });
    await ownerSays({ account, text: OWNER_BODY });
    await advanceThenRun({ account, advanceMs: WAKE_DEBOUNCE_MS });
    expect(await recordedRequests({ account })).toHaveLength(1);
    const inbox = await callTool({ client: agent, name: McpToolName.CheckInbox, arguments: {} });
    const messages = inbox.structured?.messages as { text: string }[];
    expect(messages.map((message) => message.text)).toEqual([OWNER_BODY]);
    await callTool({ client: agent, name: McpToolName.SendMessage, arguments: { text: AGENT_REPLY } });
    expect((await screenOf({ account })).map((entry) => entry.text)).toContain(AGENT_REPLY);
  });

  test('WW-3 a 503 is retried after the first backoff and the second request is delivered', async () => {
    const account = accountOf({ index: 3 });
    await enableWake({ account, responses: [UNAVAILABLE, ACCEPTED] });
    await ownerSays({ account, text: OWNER_BODY });
    await advanceThenRun({ account, advanceMs: WAKE_DEBOUNCE_MS });
    expect(await recordedRequests({ account })).toHaveLength(1);
    await advanceThenRun({ account, advanceMs: WAKE_BACKOFF_BASE_MS });
    expect(await recordedRequests({ account })).toHaveLength(2);
  });

  test('WW-4 a 401 tells the owner once, in the owner locale, that the wake failed', async () => {
    const account = accountOf({ index: 4 });
    await enableWake({ account, responses: [UNAUTHORIZED] });
    await ownerSays({ account, text: OWNER_BODY });
    await advanceThenRun({ account, advanceMs: WAKE_DEBOUNCE_MS });
    const notice = WAKE_COPY[WakeCopyKey.WakeFailed][DEFAULT_LOCALE].replace('{agent}', account.agent);
    expect((await screenOf({ account })).filter((entry) => entry.text === notice)).toHaveLength(1);
    expect(await recordedRequests({ account })).toHaveLength(1);
  });
});
