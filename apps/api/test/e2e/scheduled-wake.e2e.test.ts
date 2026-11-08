import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { expectedDelayNoteCopy, renderCopy, staleNoticeCopy, WAKE_DEBOUNCE_MS, type RecordedWakeRequest } from '@zapbip/core';
import { HOUR_MS, InboxCopyKey, MessageKind, MINUTE_MS, OwnerLocale, WakeMode } from '@zapbip/types';
import { afterAll, describe, expect, test, vi } from 'vitest';
import type { ScreenEntry } from '../../src/contract/account-inbox-rpc';
import { McpToolName } from '../../src/contract/tool-definitions';
import type { WakeAccount } from './global-setup';
import { callTool, mcpUrl, stack } from './stack';

const SCHEDULED_INTERVAL_MINUTES = 60;
const NOTE_DELAY_MS = 10 * MINUTE_MS;
const STALE_ADVANCE_MS = 2 * HOUR_MS + MINUTE_MS;
const STALE_WAIT_MS = 15_000;
const TEST_TIMEOUT_MS = 30_000;
const PRIMARY = 'agent-ten';
const STANDBY = 'agent-eight';
const GROK_URL = 'https://api2.cursor.sh/automations/webhook/abcdefgh12';
const GROK_TOKEN = 'grok-token-sixteen-chars';
const ACCEPTED = { statusCode: 200, errorName: null, retryAfterMs: null };
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const OWNER_TEXT = 'oi';
const OWNER_FOLLOW_UP = 'tem alguem ai?';
const STANDBY_REPLY = 'respondi como o grok-bot';

type WireMessage = { message_id: string; text: string };

const clients: Client[] = [];

function scheduledAccountOf(input: { index: number }): WakeAccount {
  const account = stack().scheduledAccounts[input.index];
  if (!account) throw new Error(`no scheduled account ${input.index}`);
  return account;
}

function secretOf(input: { agent: string }): string {
  const secret = stack().standbySecrets[input.agent];
  if (!secret) throw new Error(`no standby secret for ${input.agent}`);
  return secret;
}

async function connect(input: { secret: string }): Promise<Client> {
  const client = new Client({ name: 'zapbip-e2e-scheduled', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl({ secret: input.secret }))));
  clients.push(client);
  return client;
}

function ownerUrl(input: { phone: string; path: string }): string {
  return `${stack().origin}/dev/owner/${input.phone}${input.path}`;
}

async function ownerSays(input: { phone: string; text: string }): Promise<void> {
  const response = await fetch(ownerUrl({ phone: input.phone, path: '/messages' }), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ kind: MessageKind.Text, text: input.text }),
  });
  expect(response.ok).toBe(true);
}

async function advance(input: { phone: string; advanceMs: number }): Promise<void> {
  const response = await fetch(ownerUrl({ phone: input.phone, path: '/clock' }), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ advance_ms: input.advanceMs }),
  });
  expect(response.ok).toBe(true);
  expect((await fetch(ownerUrl({ phone: input.phone, path: '/wake/run' }), { method: 'POST' })).ok).toBe(true);
}

async function screenTexts(input: { phone: string }): Promise<string[]> {
  const response = await fetch(ownerUrl({ phone: input.phone, path: '/screen' }));
  return ((await response.json()) as { entries: ScreenEntry[] }).entries.map((entry) => entry.text);
}

async function messagesOf(input: { client: Client; tool: McpToolName }): Promise<WireMessage[]> {
  const result = await callTool({ client: input.client, name: input.tool, arguments: {} });
  return (result.structured?.messages ?? []) as WireMessage[];
}

async function scheduleAndPoll(input: { account: WakeAccount }): Promise<Client> {
  const client = await connect({ secret: input.account.secret });
  const scheduled = await callTool({
    client,
    name: McpToolName.SetWake,
    arguments: { mode: WakeMode.Scheduled, interval_minutes: SCHEDULED_INTERVAL_MINUTES },
  });
  expect(scheduled.isError).toBe(false);
  await callTool({ client, name: McpToolName.CheckInbox, arguments: {} });
  return client;
}

async function waitForTexts(input: { phone: string; expected: string }): Promise<void> {
  await vi.waitFor(async () => expect(await screenTexts({ phone: input.phone })).toContain(input.expected), { timeout: STALE_WAIT_MS });
}

function occurrences(input: { texts: string[]; text: string }): number {
  return input.texts.filter((candidate) => candidate === input.text).length;
}

async function staleEpisode(input: { account: WakeAccount }): Promise<{ client: Client; stale: string }> {
  const { account } = input;
  const client = await scheduleAndPoll({ account });
  await ownerSays({ phone: account.phone, text: `@${account.agent} ${OWNER_TEXT}` });
  await messagesOf({ client, tool: McpToolName.CheckInbox });
  await advance({ phone: account.phone, advanceMs: STALE_ADVANCE_MS });
  const stale = staleNoticeCopy({ locale: OwnerLocale.PortugueseBrazil, agent: account.agent, elapsedSinceLastPollMs: STALE_ADVANCE_MS });
  await waitForTexts({ phone: account.phone, expected: stale });
  return { client, stale };
}

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

describe('scheduled wake against wrangler dev', { timeout: TEST_TIMEOUT_MS }, () => {
  test('SW-1 an owner message ten minutes after the last poll gets the expected-delay note', async () => {
    const account = scheduledAccountOf({ index: 0 });
    const client = await scheduleAndPoll({ account });
    await advance({ phone: account.phone, advanceMs: NOTE_DELAY_MS });
    await ownerSays({ phone: account.phone, text: `@${account.agent} ${OWNER_TEXT}` });
    const note = expectedDelayNoteCopy({
      locale: OwnerLocale.PortugueseBrazil,
      agent: account.agent,
      intervalMinutes: SCHEDULED_INTERVAL_MINUTES,
      elapsedSinceLastPollMs: NOTE_DELAY_MS,
    });
    expect(await screenTexts({ phone: account.phone })).toContain(note);
    expect((await messagesOf({ client, tool: McpToolName.CheckInbox })).map((message) => message.text)).toEqual([OWNER_TEXT]);
  });

  test('SW-2 a silent poller gets one stale notice and the next owner text waits in its inbox', async () => {
    const account = scheduledAccountOf({ index: 1 });
    const { client, stale } = await staleEpisode({ account });
    expect(occurrences({ texts: await screenTexts({ phone: account.phone }), text: stale })).toBe(1);
    await ownerSays({ phone: account.phone, text: `@${account.agent} ${OWNER_FOLLOW_UP}` });
    const notListening = renderCopy({
      key: InboxCopyKey.AgentNotListening,
      locale: OwnerLocale.PortugueseBrazil,
      values: { agent: account.agent },
    });
    expect(await screenTexts({ phone: account.phone })).toContain(notListening);
    const history = await callTool({ client, name: McpToolName.GetMessages, arguments: {} });
    const texts = (history.structured?.history as WireMessage[]).map((message) => message.text);
    expect(texts).toContain(OWNER_FOLLOW_UP);
  });

  test('SW-3 a poll ends the episode: no new stale notice for the next hour', async () => {
    const account = scheduledAccountOf({ index: 2 });
    const { client, stale } = await staleEpisode({ account });
    await callTool({ client, name: McpToolName.CheckInbox, arguments: {} });
    await advance({ phone: account.phone, advanceMs: HOUR_MS });
    expect(occurrences({ texts: await screenTexts({ phone: account.phone }), text: stale })).toBe(1);
  });

  test('SW-4 the note is written in the locale of the owner', async () => {
    const account = scheduledAccountOf({ index: 3 });
    await scheduleAndPoll({ account });
    await advance({ phone: account.phone, advanceMs: NOTE_DELAY_MS });
    await ownerSays({ phone: account.phone, text: `@${account.agent} ${OWNER_TEXT}` });
    const note = expectedDelayNoteCopy({
      locale: OwnerLocale.EnglishUs,
      agent: account.agent,
      intervalMinutes: SCHEDULED_INTERVAL_MINUTES,
      elapsedSinceLastPollMs: NOTE_DELAY_MS,
    });
    expect(await screenTexts({ phone: account.phone })).toContain(note);
  });

  test('SW-5 the standby answers as itself and the primary inbox stays empty', async () => {
    const phone = stack().standbyPhone;
    const primary = await connect({ secret: secretOf({ agent: PRIMARY }) });
    const standby = await connect({ secret: secretOf({ agent: STANDBY }) });
    const webhook = await callTool({
      client: standby,
      name: McpToolName.SetWake,
      arguments: { mode: WakeMode.Webhook, url: GROK_URL, token: GROK_TOKEN },
    });
    expect(webhook.isError).toBe(false);
    const script = await fetch(ownerUrl({ phone, path: `/agents/${STANDBY}/wake/script` }), {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ responses: [ACCEPTED] }),
    });
    expect(script.ok).toBe(true);
    const handoff = await callTool({
      client: primary,
      name: McpToolName.SetWake,
      arguments: { mode: WakeMode.Standby, standby_agent: STANDBY },
    });
    expect(handoff.isError).toBe(false);
    await ownerSays({ phone, text: `@${PRIMARY} ${OWNER_TEXT}` });
    await advance({ phone, advanceMs: WAKE_DEBOUNCE_MS });
    const requests = (await (await fetch(ownerUrl({ phone, path: `/agents/${STANDBY}/wake/requests` }))).json()) as RecordedWakeRequest[];
    expect(requests).toHaveLength(1);
    const [copy] = await messagesOf({ client: standby, tool: McpToolName.CheckInbox });
    if (!copy) throw new Error('the standby received no copy');
    const reply = await callTool({
      client: standby,
      name: McpToolName.SendMessage,
      arguments: { text: STANDBY_REPLY, reply_to: copy.message_id },
    });
    expect(reply.isError).toBe(false);
    expect(await screenTexts({ phone })).toContain(STANDBY_REPLY);
    expect(await messagesOf({ client: primary, tool: McpToolName.CheckInbox })).toEqual([]);
  });
});
