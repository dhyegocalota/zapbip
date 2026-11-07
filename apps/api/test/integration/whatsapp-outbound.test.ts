import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ChannelError, MEDIA_LINK_TTL_MS, type CoreDependencies } from '@zapbip/core';
import { ChannelErrorKind, DeliveryState, MediaSourceKind, MessageKind, OwnerLocale, TemplateKind } from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { AccountInbox } from '../../src/account-inbox/account-inbox';
import { D1ChannelRestrictions } from '../../src/adapters/d1/d1-channel-restrictions';
import { D1MessageIndex } from '../../src/adapters/d1/d1-message-index';
import { findOwnerByAccountId } from '../../src/adapters/d1/d1-owner-directory';
import { createPlatformClock } from '../../src/adapters/platform/clock';
import { generateConnectionSecret } from '../../src/adapters/platform/connection-secret';
import { createR2MediaStore } from '../../src/adapters/r2/r2-media-store';
import { createCloudApiMessageSender } from '../../src/adapters/whatsapp/cloud-api-message-sender';
import { createGraphClient } from '../../src/adapters/whatsapp/graph-client';
import { readWhatsAppEnvironment } from '../../src/adapters/whatsapp/read-whatsapp-env';
import { RESTRICTION_TTL_MS } from '../../src/adapters/whatsapp/whatsapp-constants';
import { McpToolName } from '../../src/contract/tool-definitions';
import buttonsFixture from '../fixtures/whatsapp/outbound/buttons.json';
import listFixture from '../fixtures/whatsapp/outbound/list.json';
import templateEnglishFixture from '../fixtures/whatsapp/outbound/template-notice-en_US.json';
import templatePortugueseFixture from '../fixtures/whatsapp/outbound/template-notice-pt_BR.json';
import textFixture from '../fixtures/whatsapp/outbound/text.json';
import { buildEnvelope, buildQuestion, buildTextMessage } from '../support/builders';
import { FakeGraph } from '../support/fake-graph';
import { applyDirectoryMigration, seedConnection, seedOwnerIdentity } from '../support/seed';
import { accountInboxStub, testEnv, whatsappTestEnv } from '../support/workers-env';
import { callTool, connectClient, ownerText, ownerWrites, type ToolResult } from './mcp-fixtures';

const FIRST_ACCOUNT = 'acc_a';
const SECOND_ACCOUNT = 'acc_b';
const FIRST_OWNER_WA_ID = '5511900000001';
const SECOND_OWNER_WA_ID = '5511900000002';
const PUBLIC_ORIGIN = 'https://api.test';
const MESSAGES_PATH = '/v24.0/1000000000000001/messages';
const TOOL_AGENT = 'Agente de teste';
const NOTICE_TEXT = 'Mensagem de exemplo';
const SESSION_TEXT = 'Olá';
const WINDOW_CLOSED_CODE = 131_047;
const REACTION_TARGET_INVALID_CODE = 131_009;
const RATE_LIMITED_CODE = 130_429;
const SERVER_ERROR_STATUS = 500;
const BAD_REQUEST_STATUS = 400;
const REACTION_TARGET_FIELD = 'reaction.message_id';
const BUSY_TEXT = 'busy';
const TIMEOUT_TEXT = 'did not answer in time';
const TEMPLATE_MESSAGE_TYPE = 'template';

const whatsapp = readWhatsAppEnvironment({ env: whatsappTestEnv });
const fakeGraph = new FakeGraph({ baseUrl: whatsapp.graphBaseUrl });
const clock = createPlatformClock();

let errorSpy: MockInstance<typeof console.error>;

function senderFor(input: { accountId: string }) {
  return createCloudApiMessageSender({
    accountId: input.accountId,
    graph: createGraphClient({
      baseUrl: whatsapp.graphBaseUrl,
      accessToken: whatsapp.accessToken,
      developmentMediaOrigin: null,
      fetcher: fetch,
    }),
    findOwnerByAccountId: (lookup) => findOwnerByAccountId({ database: testEnv.CONNECTIONS, accountId: lookup.accountId }),
    messageIndex: new D1MessageIndex({ database: testEnv.CONNECTIONS }),
    restrictions: new D1ChannelRestrictions({ database: testEnv.CONNECTIONS, phoneNumberId: whatsapp.phoneNumberId }),
    mediaStore: createR2MediaStore({
      bucket: testEnv.MEDIA,
      mediaLinkSigningKey: testEnv.MEDIA_LINK_SIGNING_KEY,
      uploadLinkSigningKey: testEnv.UPLOAD_LINK_SIGNING_KEY,
      clock,
    }),
    publicOrigin: PUBLIC_ORIGIN,
    phoneNumberId: whatsapp.phoneNumberId,
    clock,
  });
}

function textInput(input: { text: string }) {
  return {
    message: buildTextMessage({ messageId: 'msg_1', text: input.text }),
    question: null,
    replyToChannelMessageId: null,
    reactionTargetChannelMessageId: null,
  };
}

async function sentBodies(): Promise<unknown[]> {
  const requests = await fakeGraph.requests();
  return requests.filter((request) => request.path === MESSAGES_PATH).map((request) => request.body);
}

async function failureOf(input: { run: () => Promise<unknown> }): Promise<ChannelError> {
  const failure = await input.run().then(
    () => null,
    (error: unknown) => error,
  );
  expect(failure).toBeInstanceOf(ChannelError);
  return failure as ChannelError;
}

async function refuseNextSend(input: { status: number; errorCode: number }): Promise<void> {
  await fakeGraph.respondWith({
    method: 'POST',
    path: MESSAGES_PATH,
    status: input.status,
    body: { error: { code: input.errorCode, message: 'refused' } },
  });
}

beforeEach(async () => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await applyDirectoryMigration();
  await seedOwnerIdentity({ accountId: FIRST_ACCOUNT, phone: FIRST_OWNER_WA_ID, ownerLocale: OwnerLocale.PortugueseBrazil });
  await fakeGraph.reset();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe('Cloud API sender against the fake Graph', () => {
  it('WI-58 sends a text and maps the returned id to the account', async () => {
    const sent = await senderFor({ accountId: FIRST_ACCOUNT }).session(textInput({ text: 'Olá' }));
    expect(await sentBodies()).toEqual([textFixture]);
    expect(await new D1MessageIndex({ database: testEnv.CONNECTIONS }).find({ id: sent.channelMessageId })).toEqual({
      accountId: FIRST_ACCOUNT,
    });
  });

  it('WI-59 reports a closed window and then sends the notice template', async () => {
    const sender = senderFor({ accountId: FIRST_ACCOUNT });
    await refuseNextSend({ status: 400, errorCode: 131_047 });
    const error = await failureOf({ run: () => sender.session(textInput({ text: 'Olá' })) });
    expect(error.code).toBe(ChannelErrorKind.WindowClosed);
    await sender.template({
      kind: TemplateKind.Notice,
      locale: OwnerLocale.PortugueseBrazil,
      parameters: ['Agente de teste', 'Mensagem de exemplo'],
    });
    expect((await sentBodies()).at(-1)).toEqual(templatePortugueseFixture);
  });

  it('WI-61 names the kind and the MIME type of a rejected image', async () => {
    await refuseNextSend({ status: 400, errorCode: 131_053 });
    const error = await failureOf({
      run: () =>
        senderFor({ accountId: FIRST_ACCOUNT }).session({
          ...textInput({ text: '' }),
          message: {
            ...buildEnvelope({ messageId: 'msg_2' }),
            kind: MessageKind.Image,
            source: { kind: MediaSourceKind.Link, link: 'https://files.example/a.jpg' },
            mimeType: 'image/jpeg',
            sizeBytes: 1_000,
            filename: null,
            caption: null,
          },
        }),
    });
    expect(error.code).toBe(ChannelErrorKind.MediaRejected);
    expect(error.message).toMatch(/image.*image\/jpeg/);
  });

  it.each([131_048, 368])('WI-63 and WI-65 refuse sends after Graph returns %i, without a request', async (errorCode) => {
    const sender = senderFor({ accountId: FIRST_ACCOUNT });
    await refuseNextSend({ status: 400, errorCode });
    const first = await failureOf({ run: () => sender.session(textInput({ text: 'Olá' })) });
    expect(first.code).toBe(ChannelErrorKind.Restricted);
    expect(
      await new D1ChannelRestrictions({ database: testEnv.CONNECTIONS, phoneNumberId: whatsapp.phoneNumberId }).findActive({
        now: clock.now(),
      }),
    ).toEqual({ errorCode });
    const second = await failureOf({ run: () => sender.session(textInput({ text: 'de novo' })) });
    expect(second.code).toBe(ChannelErrorKind.Restricted);
    expect(await sentBodies()).toHaveLength(1);
  });

  it('WI-64 sends again once the restriction is older than its time to live', async () => {
    await new D1ChannelRestrictions({ database: testEnv.CONNECTIONS, phoneNumberId: whatsapp.phoneNumberId }).record({
      errorCode: 131_048,
      restrictedAt: clock.now() - RESTRICTION_TTL_MS - 1,
    });
    await senderFor({ accountId: FIRST_ACCOUNT }).session(textInput({ text: 'Olá' }));
    expect(await sentBodies()).toHaveLength(1);
  });

  it('WI-67 maps an auth error and keeps the token out of the log', async () => {
    await refuseNextSend({ status: 401, errorCode: 190 });
    const error = await failureOf({ run: () => senderFor({ accountId: FIRST_ACCOUNT }).session(textInput({ text: 'Olá' })) });
    expect(error.code).toBe(ChannelErrorKind.Auth);
    const logged = errorSpy.mock.calls.map(([line]) => String(line)).join('\n');
    expect(logged).toContain('channel.auth');
    expect(logged).not.toContain(whatsapp.accessToken);
  });

  it('WI-68 sends the English notice', async () => {
    await senderFor({ accountId: FIRST_ACCOUNT }).template({
      kind: TemplateKind.Notice,
      locale: OwnerLocale.EnglishUs,
      parameters: ['Agente de teste', 'Mensagem de exemplo'],
    });
    expect(await sentBodies()).toEqual([templateEnglishFixture]);
  });

  it('WI-69 maps an unknown template code to template rejected', async () => {
    await refuseNextSend({ status: 400, errorCode: 132_000 });
    const error = await failureOf({
      run: () =>
        senderFor({ accountId: FIRST_ACCOUNT }).template({
          kind: TemplateKind.Notice,
          locale: OwnerLocale.EnglishUs,
          parameters: ['a', 'b'],
        }),
    });
    expect(error.code).toBe(ChannelErrorKind.TemplateRejected);
    expect(errorSpy.mock.calls.map(([line]) => String(line)).join('\n')).toContain('channel.template_rejected');
  });

  it('sends a three-option question as reply buttons', async () => {
    await senderFor({ accountId: FIRST_ACCOUNT }).session({
      message: {
        ...buildEnvelope({ messageId: 'msg_3' }),
        kind: MessageKind.Choice,
        questionId: 'qst_1',
        selected: null,
        options: ['Sim', 'Não', 'Depois'].map((title, optionIndex) => ({ optionIndex, title, description: null })),
      },
      question: buildQuestion({ questionId: 'qst_1', text: 'Fazer o deploy?' }),
      replyToChannelMessageId: null,
      reactionTargetChannelMessageId: null,
    });
    expect(await sentBodies()).toEqual([buttonsFixture]);
  });

  it('WI-70 sends a four-option question as a list with the owner copy', async () => {
    await senderFor({ accountId: FIRST_ACCOUNT }).session({
      message: {
        ...buildEnvelope({ messageId: 'msg_4' }),
        kind: MessageKind.Choice,
        questionId: 'qst_1',
        selected: null,
        options: [
          { optionIndex: 0, title: 'Produção', description: null },
          { optionIndex: 1, title: 'Staging', description: 'Ambiente de testes' },
          { optionIndex: 2, title: 'Local', description: null },
          { optionIndex: 3, title: 'Sandbox', description: null },
        ],
      },
      question: buildQuestion({ questionId: 'qst_1', text: 'Qual ambiente?' }),
      replyToChannelMessageId: null,
      reactionTargetChannelMessageId: null,
    });
    expect(await sentBodies()).toEqual([listFixture]);
  });

  it('WI-71 links stored media through PUBLIC_ORIGIN and a signed query', async () => {
    await senderFor({ accountId: FIRST_ACCOUNT }).session({
      ...textInput({ text: '' }),
      message: {
        ...buildEnvelope({ messageId: 'msg_5' }),
        kind: MessageKind.Image,
        source: { kind: MediaSourceKind.Stored, mediaId: 'med_1' },
        mimeType: 'image/jpeg',
        sizeBytes: 1_000,
        filename: null,
        caption: null,
      },
    });
    const [body] = await sentBodies();
    const link = (body as { image: { link: string } }).image.link;
    const pattern = new RegExp(`^${PUBLIC_ORIGIN}/m/${FIRST_ACCOUNT}/med_1\\?exp=\\d+&sig=[A-Za-z0-9_-]+$`);
    expect(link).toMatch(pattern);
    expect(MEDIA_LINK_TTL_MS).toBeGreaterThan(0);
  });

  it('WI-72 replaces a blank preview with the locale fallback', async () => {
    await senderFor({ accountId: FIRST_ACCOUNT }).template({
      kind: TemplateKind.Notice,
      locale: OwnerLocale.PortugueseBrazil,
      parameters: ['alpha', '   '],
    });
    expect(await sentBodies()).toMatchObject([
      { template: { components: [{ parameters: [{ text: 'alpha' }, { text: 'uma mensagem' }] }] } },
    ]);
  });

  it('WI-73 sends each account only to its own owner', async () => {
    await seedOwnerIdentity({ accountId: SECOND_ACCOUNT, phone: SECOND_OWNER_WA_ID, ownerLocale: OwnerLocale.EnglishUs });
    await senderFor({ accountId: FIRST_ACCOUNT }).session(textInput({ text: 'um' }));
    await senderFor({ accountId: SECOND_ACCOUNT }).session(textInput({ text: 'dois' }));
    expect(await sentBodies()).toMatchObject([
      { to: FIRST_OWNER_WA_ID, text: { body: 'um' } },
      { to: SECOND_OWNER_WA_ID, text: { body: 'dois' } },
    ]);
  });
});

type SenderSelection = { createSender: (input: { mediaStore: CoreDependencies['mediaStore'] }) => CoreDependencies['sender'] };
type HistoryEntry = { kind: MessageKind; text: string | null; delivery: DeliveryState | null };

function installCloudApiSender(): Promise<void> {
  return runInDurableObject(accountInboxStub({ accountId: FIRST_ACCOUNT }), (instance) => {
    const internals = instance as unknown as { dependencies: CoreDependencies };
    const withCloudApiEnvironment = Object.create(instance, { env: { value: whatsappTestEnv } }) as SenderSelection;
    const createSender = (AccountInbox.prototype as unknown as SenderSelection).createSender;
    internals.dependencies.sender = createSender.call(withCloudApiEnvironment, { mediaStore: internals.dependencies.mediaStore });
  });
}

describe('send tools over the Cloud API sender', () => {
  let client: Client;
  let openingMessageId: string;

  function call(input: { name: McpToolName; arguments: Record<string, unknown> }): Promise<ToolResult> {
    return callTool({ client, name: input.name, arguments: input.arguments });
  }

  async function historyOf(): Promise<HistoryEntry[]> {
    const result = await call({ name: McpToolName.GetMessages, arguments: {} });
    return [...(result.structuredContent?.unread as HistoryEntry[]), ...(result.structuredContent?.history as HistoryEntry[])];
  }

  beforeEach(async () => {
    const secret = generateConnectionSecret();
    await seedConnection({ accountId: FIRST_ACCOUNT, agent: TOOL_AGENT, secret });
    client = await connectClient({ secret });
    await historyOf();
    openingMessageId = await ownerWrites({
      accountId: FIRST_ACCOUNT,
      channelMessageId: 'wamid.open-window',
      content: ownerText({ text: 'oi' }),
    });
    await installCloudApiSender();
    await fakeGraph.reset();
  });

  it('WI-58 sends the text through send_message, stores the returned wamid and maps it to the account', async () => {
    const result = await call({ name: McpToolName.SendMessage, arguments: { text: SESSION_TEXT } });
    expect(result.structuredContent).toMatchObject({ delivery: DeliveryState.Sent });
    expect(await sentBodies()).toEqual([textFixture]);
    const rows = await testEnv.CONNECTIONS.prepare('SELECT wamid, account_id FROM message_index').all<{
      wamid: string;
      account_id: string;
    }>();
    expect(rows.results).toEqual([{ wamid: expect.stringMatching(/^wamid\.fake\./), account_id: FIRST_ACCOUNT }]);
  });

  it('WI-59 queues the message when Graph reports a closed window, and sends one notice only', async () => {
    await refuseNextSend({ status: BAD_REQUEST_STATUS, errorCode: WINDOW_CLOSED_CODE });
    const first = await call({ name: McpToolName.SendMessage, arguments: { text: NOTICE_TEXT } });
    const second = await call({ name: McpToolName.SendMessage, arguments: { text: NOTICE_TEXT } });
    expect([first.structuredContent, second.structuredContent]).toMatchObject([
      { delivery: DeliveryState.Queued },
      { delivery: DeliveryState.Queued },
    ]);
    const templates = (await sentBodies()).filter((body) => (body as { type: string }).type === TEMPLATE_MESSAGE_TYPE);
    expect(templates).toEqual([templatePortugueseFixture]);
    expect((await historyOf()).filter((entry) => entry.delivery === DeliveryState.Queued)).toHaveLength(2);
  });

  it('WI-60 fails a rejected reaction, names reaction.message_id and marks the reaction failed', async () => {
    await refuseNextSend({ status: BAD_REQUEST_STATUS, errorCode: REACTION_TARGET_INVALID_CODE });
    const result = await call({ name: McpToolName.React, arguments: { message_id: openingMessageId, emoji: '👍' } });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain(REACTION_TARGET_FIELD);
    expect((await historyOf()).find((entry) => entry.kind === MessageKind.Reaction)?.delivery).toBe(DeliveryState.Failed);
  });

  it('WI-62 fails a rate limited send as busy, marks it failed and makes no second request', async () => {
    await refuseNextSend({ status: BAD_REQUEST_STATUS, errorCode: RATE_LIMITED_CODE });
    const result = await call({ name: McpToolName.SendMessage, arguments: { text: SESSION_TEXT } });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain(BUSY_TEXT);
    expect(await sentBodies()).toHaveLength(1);
    expect((await historyOf()).find((entry) => entry.text === SESSION_TEXT)?.delivery).toBe(DeliveryState.Failed);
  });

  it('WI-66 fails a Graph server error as a timeout, marks it failed and makes no second request', async () => {
    await refuseNextSend({ status: SERVER_ERROR_STATUS, errorCode: 0 });
    const result = await call({ name: McpToolName.SendMessage, arguments: { text: SESSION_TEXT } });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain(TIMEOUT_TEXT);
    expect(await sentBodies()).toHaveLength(1);
    expect((await historyOf()).find((entry) => entry.text === SESSION_TEXT)?.delivery).toBe(DeliveryState.Failed);
  });
});
