import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { staleNoticeCopy, WINDOW_MS } from '@zapbip/core';
import { HOUR_MS, OwnerLocale, SECOND_MS, WakeMode } from '@zapbip/types';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { McpToolName } from '../../src/contract/tool-definitions';
import textFixture from '../fixtures/whatsapp/inbound/text.json';
import type { RecordedRequest } from '../support/fake-graph';
import type { WakeAccount } from './global-setup';
import { callTool, mcpUrl, stack } from './stack';
import { GRAPH_MESSAGES_PATH } from './whatsapp-support/constants';
import { fakeGraph, postSignedMessage, sentRequests } from './whatsapp-support/webhook';

const SCHEDULED_INTERVAL_MINUTES = 60;
const NO_OFFSET_MS = 0;
const CLOSED_WINDOW_OFFSET_MS = WINDOW_MS + 1;
const ALARM_TIMEOUT_MS = 20 * SECOND_MS;
const TEST_TIMEOUT_MS = 40 * SECOND_MS;
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const GRAPH_SERVER_ERROR_STATUS = 500;
const STALE_NOTICE_SENDER = 'zapbip';
const AGENT_REPLY = 'resposta do agente';
const TEMPLATE_TYPE = 'template';
const TEXT_TYPE = 'text';
const FIRST_ACCOUNT_INDEX = 0;
const SECOND_ACCOUNT_INDEX = 1;

type SentBody = {
  to: string;
  type: string;
  text?: { body: string };
  template?: { components: { parameters: { text: string }[] }[] };
};

const clients: Client[] = [];
let messageCounter = 0;

function accountOf(input: { index: number }): WakeAccount {
  const account = stack().scheduledAccounts[input.index];
  if (!account) throw new Error(`no scheduled account ${input.index}`);
  return account;
}

async function connect(input: { account: WakeAccount }): Promise<Client> {
  const client = new Client({ name: 'zapbip-e2e-whatsapp-scheduled', version: '0.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl({ secret: input.account.secret }))));
  clients.push(client);
  return client;
}

async function advance(input: { phone: string; advanceMs: number }): Promise<void> {
  const response = await fetch(`${stack().origin}/dev/owner/${input.phone}/clock`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ advance_ms: input.advanceMs }),
  });
  expect(response.ok).toBe(true);
}

async function ownerWrites(input: { phone: string; text: string; offsetMs: number }): Promise<void> {
  messageCounter += 1;
  const message = { ...textFixture, id: `wamid.SCHEDULED${messageCounter}`, from: input.phone, text: { body: input.text } };
  const response = await postSignedMessage({ message, offsetMs: input.offsetMs });
  expect(response.ok).toBe(true);
}

async function sentTo(input: { phone: string; type: string }): Promise<SentBody[]> {
  const requests: RecordedRequest[] = await sentRequests();
  return requests.map((request) => request.body as SentBody).filter((body) => body.to === input.phone && body.type === input.type);
}

function templateParametersOf(input: { body: SentBody }): string[] {
  const component = input.body.template?.components[0];
  if (!component) throw new Error('the template has no body component');
  return component.parameters.map((parameter) => parameter.text);
}

async function scheduleAndPoll(input: { account: WakeAccount }): Promise<Client> {
  const client = await connect({ account: input.account });
  const scheduled = await callTool({
    client,
    name: McpToolName.SetWake,
    arguments: { mode: WakeMode.Scheduled, interval_minutes: SCHEDULED_INTERVAL_MINUTES },
  });
  expect(scheduled.isError).toBe(false);
  await callTool({ client, name: McpToolName.CheckInbox, arguments: {} });
  return client;
}

async function waitForTemplates(input: { phone: string; count: number }): Promise<void> {
  await expect
    .poll(async () => (await sentTo({ phone: input.phone, type: TEMPLATE_TYPE })).length, { timeout: ALARM_TIMEOUT_MS })
    .toBe(input.count);
}

function staleNoticeOf(input: { account: WakeAccount }): string {
  return staleNoticeCopy({
    locale: OwnerLocale.PortugueseBrazil,
    agent: input.account.agent,
    elapsedSinceLastPollMs: CLOSED_WINDOW_OFFSET_MS,
  });
}

beforeAll(async () => {
  await fakeGraph.reset();
});

afterAll(async () => {
  await Promise.all(clients.map((client) => client.close()));
});

describe('scheduled wake on the WhatsApp channel', { timeout: TEST_TIMEOUT_MS }, () => {
  test('SW-WA-1 a silent scheduled agent in a closed window gets one notice template naming the agent and the elapsed time', async () => {
    const account = accountOf({ index: FIRST_ACCOUNT_INDEX });
    await ownerWrites({ phone: account.phone, text: 'oi', offsetMs: NO_OFFSET_MS });
    await scheduleAndPoll({ account });
    await advance({ phone: account.phone, advanceMs: CLOSED_WINDOW_OFFSET_MS });
    await waitForTemplates({ phone: account.phone, count: 1 });
    const [template] = await sentTo({ phone: account.phone, type: TEMPLATE_TYPE });
    if (!template) throw new Error('no template was sent');
    expect(templateParametersOf({ body: template })).toEqual([STALE_NOTICE_SENDER, staleNoticeOf({ account })]);
  });

  test('SW-WA-2 when the owner writes, the queued notice arrives as text and no second template is sent', async () => {
    const account = accountOf({ index: FIRST_ACCOUNT_INDEX });
    await ownerWrites({ phone: account.phone, text: 'voltei', offsetMs: CLOSED_WINDOW_OFFSET_MS });
    await expect
      .poll(async () => (await sentTo({ phone: account.phone, type: TEXT_TYPE })).map((body) => body.text?.body), {
        timeout: ALARM_TIMEOUT_MS,
      })
      .toContain(staleNoticeOf({ account }));
    expect(await sentTo({ phone: account.phone, type: TEMPLATE_TYPE })).toHaveLength(1);
  });

  test('SW-WA-3 a zapbip note queued ahead of an agent message: the retry template names the agent', async () => {
    const account = accountOf({ index: SECOND_ACCOUNT_INDEX });
    await ownerWrites({ phone: account.phone, text: 'oi', offsetMs: NO_OFFSET_MS });
    const client = await scheduleAndPoll({ account });
    await fakeGraph.respondWith({
      method: 'POST',
      path: GRAPH_MESSAGES_PATH,
      status: GRAPH_SERVER_ERROR_STATUS,
      body: { error: { code: GRAPH_SERVER_ERROR_STATUS, message: 'unavailable' } },
    });
    await advance({ phone: account.phone, advanceMs: CLOSED_WINDOW_OFFSET_MS });
    await waitForTemplates({ phone: account.phone, count: 1 });
    const sent = await callTool({ client, name: McpToolName.SendMessage, arguments: { text: AGENT_REPLY } });
    expect(sent.isError).toBe(false);
    await advance({ phone: account.phone, advanceMs: HOUR_MS });
    await waitForTemplates({ phone: account.phone, count: 2 });
    const retry = (await sentTo({ phone: account.phone, type: TEMPLATE_TYPE })).at(-1);
    if (!retry) throw new Error('no retry template was sent');
    expect(templateParametersOf({ body: retry })).toEqual([account.agent, AGENT_REPLY]);
  });
});
