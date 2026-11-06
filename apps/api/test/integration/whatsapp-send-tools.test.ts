import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CoreDependencies } from '@zapbip/core';
import { DeliveryState, MessageKind, OwnerLocale } from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountInbox } from '../../src/account-inbox/account-inbox';
import { readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import { McpToolName } from '../../src/contract/tool-definitions';
import { generateConnectionSecret } from '../../src/adapters/platform/connection-secret';
import templatePortugueseFixture from '../fixtures/whatsapp/outbound/template-notice-pt_BR.json';
import textFixture from '../fixtures/whatsapp/outbound/text.json';
import { FakeGraph } from '../support/fake-graph';
import { applyDirectoryMigration, seedConnection, seedOwnerIdentity } from '../support/seed';
import { accountInboxStub, testEnv, whatsappTestEnv } from '../support/workers-env';
import { callTool, connectClient, ownerText, ownerWrites, type ToolResult } from './mcp-fixtures';

const AGENT = 'Agente de teste';
const OWNER_WA_ID = '5511900000001';
const MESSAGES_PATH = '/v24.0/1000000000000001/messages';
const NOTICE_TEXT = 'Mensagem de exemplo';
const SESSION_TEXT = 'Olá';
const WINDOW_CLOSED_CODE = 131_047;
const REACTION_TARGET_INVALID_CODE = 131_009;
const RATE_LIMITED_CODE = 130_429;
const SERVER_ERROR_STATUS = 500;
const BAD_REQUEST_STATUS = 400;
const REACTION_TARGET_FIELD = 'reaction.message_id';
const BUSY_TEXT = 'busy';

type SenderSelection = { createSender: (input: { mediaStore: CoreDependencies['mediaStore'] }) => CoreDependencies['sender'] };
type HistoryEntry = { kind: MessageKind; text: string | null; delivery: DeliveryState | null };

const whatsapp = readWhatsAppEnvironment({ env: whatsappTestEnv });
const fakeGraph = new FakeGraph({ baseUrl: whatsapp.graphBaseUrl });

let client: Client;
let accountId: string;
let openingMessageId: string;

function call(input: { name: McpToolName; arguments: Record<string, unknown> }): Promise<ToolResult> {
  return callTool({ client, name: input.name, arguments: input.arguments });
}

function installCloudApiSender(): Promise<void> {
  return runInDurableObject(accountInboxStub({ accountId }), (instance) => {
    const internals = instance as unknown as { dependencies: CoreDependencies };
    const withCloudApiEnvironment = Object.create(instance, { env: { value: whatsappTestEnv } }) as SenderSelection;
    const createSender = (AccountInbox.prototype as unknown as SenderSelection).createSender;
    internals.dependencies.sender = createSender.call(withCloudApiEnvironment, { mediaStore: internals.dependencies.mediaStore });
  });
}

async function historyOf(): Promise<HistoryEntry[]> {
  const result = await call({ name: McpToolName.GetMessages, arguments: {} });
  return [...(result.structuredContent?.unread as HistoryEntry[]), ...(result.structuredContent?.history as HistoryEntry[])];
}

async function messagePosts(): Promise<{ body: unknown }[]> {
  return (await fakeGraph.requests()).filter((request) => request.path === MESSAGES_PATH);
}

function refuseNextSend(input: { status: number; errorCode: number }): Promise<void> {
  return fakeGraph.respondWith({
    method: 'POST',
    path: MESSAGES_PATH,
    status: input.status,
    body: { error: { code: input.errorCode, message: 'refused' } },
  });
}

function sentRows(): Promise<{ wamid: string; account_id: string }[]> {
  return testEnv.CONNECTIONS.prepare('SELECT wamid, account_id FROM message_index')
    .all<{ wamid: string; account_id: string }>()
    .then((result) => result.results);
}

beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await applyDirectoryMigration();
  accountId = `acc_${crypto.randomUUID()}`;
  await seedOwnerIdentity({ accountId, phone: OWNER_WA_ID, ownerLocale: OwnerLocale.PortugueseBrazil });
  const secret = generateConnectionSecret();
  await seedConnection({ accountId, agent: AGENT, secret });
  client = await connectClient({ secret });
  await historyOf();
  openingMessageId = await ownerWrites({ accountId, channelMessageId: 'wamid.open-window', content: ownerText({ text: 'oi' }) });
  await installCloudApiSender();
  await fakeGraph.reset();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe('send tools over the Cloud API sender', () => {
  it('WI-58 sends the text, stores the returned wamid and maps it to the account', async () => {
    const result = await call({ name: McpToolName.SendMessage, arguments: { text: SESSION_TEXT } });
    expect(result.structuredContent).toMatchObject({ delivery: DeliveryState.Sent });
    expect((await messagePosts()).map((request) => request.body)).toEqual([textFixture]);
    expect(await sentRows()).toEqual([{ wamid: expect.stringMatching(/^wamid\.fake\./), account_id: accountId }]);
  });

  it('WI-59 queues the message when Graph reports a closed window, and sends one notice only', async () => {
    await refuseNextSend({ status: BAD_REQUEST_STATUS, errorCode: WINDOW_CLOSED_CODE });
    const first = await call({ name: McpToolName.SendMessage, arguments: { text: NOTICE_TEXT } });
    expect(first.structuredContent).toMatchObject({ delivery: DeliveryState.Queued });
    const second = await call({ name: McpToolName.SendMessage, arguments: { text: NOTICE_TEXT } });
    expect(second.structuredContent).toMatchObject({ delivery: DeliveryState.Queued });
    const templates = (await messagePosts())
      .map((request) => request.body)
      .filter((body) => (body as { type: string }).type === 'template');
    expect(templates).toEqual([templatePortugueseFixture]);
    expect((await historyOf()).filter((entry) => entry.delivery === DeliveryState.Queued)).toHaveLength(2);
  });

  it('WI-60 fails a rejected reaction, names reaction.message_id and marks the message failed', async () => {
    await refuseNextSend({ status: BAD_REQUEST_STATUS, errorCode: REACTION_TARGET_INVALID_CODE });
    const result = await call({ name: McpToolName.React, arguments: { message_id: openingMessageId, emoji: '👍' } });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain(REACTION_TARGET_FIELD);
    expect((await historyOf()).find((entry) => entry.kind === MessageKind.Reaction)?.delivery).toBe(DeliveryState.Failed);
  });

  it('WI-62 fails a rate limited send as busy and makes no second request', async () => {
    await refuseNextSend({ status: BAD_REQUEST_STATUS, errorCode: RATE_LIMITED_CODE });
    const result = await call({ name: McpToolName.SendMessage, arguments: { text: SESSION_TEXT } });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain(BUSY_TEXT);
    expect(await messagePosts()).toHaveLength(1);
    expect((await historyOf()).find((entry) => entry.text === SESSION_TEXT)?.delivery).toBe(DeliveryState.Failed);
  });

  it('WI-66 fails a Graph server error as a timeout and makes no second request', async () => {
    await refuseNextSend({ status: SERVER_ERROR_STATUS, errorCode: 0 });
    const result = await call({ name: McpToolName.SendMessage, arguments: { text: SESSION_TEXT } });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('did not answer in time');
    expect(await messagePosts()).toHaveLength(1);
    expect((await historyOf()).find((entry) => entry.text === SESSION_TEXT)?.delivery).toBe(DeliveryState.Failed);
  });
});
