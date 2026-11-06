import { env, runInDurableObject, SELF } from 'cloudflare:test';
import { formatOptionId, HISTORY_LIMIT, isOwnerWindowOpen, RECEIPT_RETENTION_MS, type CoreDependencies } from '@zapbip/core';
import {
  DeliveryState,
  ForwardedKind,
  MediaSourceKind,
  MessageDirection,
  MessageKind,
  MessageSender,
  MINUTE_MS,
  OwnerLocale,
  SECOND_MS,
} from '@zapbip/types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../../src/app';
import {
  GRAPH_REQUEST_TIMEOUT_MS,
  MAX_FUTURE_SKEW_MS,
  WEBHOOK_MAX_BYTES,
  WEBHOOK_SIGNATURE_HEADER,
} from '../../src/adapters/whatsapp/whatsapp-constants';
import { OwnerCopyKey, WHATSAPP_COPY } from '../../src/adapters/whatsapp/whatsapp-copy';
import { OperatorEvent } from '../../src/adapters/whatsapp/whatsapp-enums';
import { WHATSAPP_WEBHOOK_PATH } from '../../src/contract/constants';
import { toWireMessage } from '../../src/mcp/wire';
import imageFixture from '../fixtures/whatsapp/inbound/image.json';
import orderFixture from '../fixtures/whatsapp/inbound/order.json';
import audioVoiceFixture from '../fixtures/whatsapp/inbound/audio-voice.json';
import buttonFixture from '../fixtures/whatsapp/inbound/button.json';
import imageForwardedFixture from '../fixtures/whatsapp/inbound/image-forwarded.json';
import listReplyFixture from '../fixtures/whatsapp/inbound/list-reply.json';
import reactionFixture from '../fixtures/whatsapp/inbound/reaction.json';
import textFixture from '../fixtures/whatsapp/inbound/text.json';
import textForwardedFixture from '../fixtures/whatsapp/inbound/text-forwarded.json';
import textFrequentlyForwardedFixture from '../fixtures/whatsapp/inbound/text-frequently-forwarded.json';
import textReplyFixture from '../fixtures/whatsapp/inbound/text-reply.json';
import unsupportedFixture from '../fixtures/whatsapp/inbound/unsupported.json';
import {
  changeOf,
  FOREIGN_PHONE_NUMBER_ID,
  notificationOf,
  notificationWith,
  OUR_PHONE_NUMBER_ID,
} from '../fixtures/whatsapp/inbound/notification';
import { signatureHeaderOf } from '../fixtures/whatsapp/inbound/signed-webhook';
import { accountInboxStub, whatsappTestEnv } from '../support/workers-env';
import { buildTextMessage } from '../support/builders';
import { inboxOf, ORIGIN, seedAccount, type SeededAccount } from './route-fixtures';

const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_PAYLOAD_TOO_LARGE = 413;
const CONCURRENT_POSTS = 10;
const STATUS_NOT_FOUND = 404;
const STATUS_FOUND = 302;
const STATUS_DOWNLOAD_FAILED = 500;
const STATUS_SERVER_ERROR = 500;
const WEBHOOK_URL = `${ORIGIN}${WHATSAPP_WEBHOOK_PATH}`;
const CHUNK_BYTES = 64_000;
const UNKNOWN_PHONE = '5511900000099';
const IMAGE_METADATA_PATH = `/${imageFixture.image.id}`;
const IMAGE_DOWNLOAD_URL = 'https://media.fbsbx.com/image';
const IMAGE_BYTES = new TextEncoder().encode('image-bytes');
const WRONG_DIGEST = 'd3Jvbmc=';
const FOREIGN_HOST = 'evil.example.com';
const FOREIGN_DOWNLOAD_URL = `https://${FOREIGN_HOST}/image`;
const USERINFO_TRICK_URL = 'https://lookaside.fbsbx.com@evil.com/x';
const PATH_TRICK_URL = 'https://evil.com/.fbsbx.com/x';
const SECURE_PREFIX = 'https://';
const MEDIA_KEY_PREFIX = 'accounts';
const UNSUPPORTED_NOTICE = WHATSAPP_COPY[OwnerLocale.PortugueseBrazil][OwnerCopyKey.UnsupportedKind];
const STALE_MARGIN_MS = MINUTE_MS;
const VOICE_BYTES = new TextEncoder().encode('voice-bytes');
const TOO_LARGE_CODE = 131_052;
const STATUS_BAD_REQUEST_GRAPH = 400;
const AGENT_CHANNEL_MESSAGE_ID = 'wamid.AGENT';
const AGENT_MESSAGE_ID = 'msg_agent_1';

type GraphCall = { url: string; authorization: string | null };
type DownloadScript = (input: { attempt: number; signal: AbortSignal | null | undefined }) => Response | Promise<Response>;

afterEach(() => {
  vi.restoreAllMocks();
});

function encode(input: { text: string }): Uint8Array {
  return new TextEncoder().encode(input.text);
}

function ownerText(input: { account: SeededAccount; id: string; text: string }): object {
  return { ...textFixture, from: input.account.phone, id: input.id, timestamp: nowInSeconds(), text: { body: input.text } };
}

async function postSigned(input: { text: string; signedText?: string }): Promise<Response> {
  const signature = await signatureHeaderOf({
    appSecret: env.META_APP_SECRET as string,
    body: encode({ text: input.signedText === undefined ? input.text : input.signedText }),
  });
  return SELF.fetch(WEBHOOK_URL, { method: 'POST', headers: { [WEBHOOK_SIGNATURE_HEADER]: signature }, body: input.text });
}

function postNotification(input: { notification: object }): Promise<Response> {
  return postSigned({ text: JSON.stringify(input.notification) });
}

async function postNotificationWithAccessToken(input: { notification: object; developmentMediaOrigin?: string }): Promise<Response> {
  const { developmentMediaOrigin = null } = input;
  const text = JSON.stringify(input.notification);
  const signature = await signatureHeaderOf({ appSecret: env.META_APP_SECRET as string, body: encode({ text }) });
  const request = new Request(WEBHOOK_URL, { method: 'POST', headers: { [WEBHOOK_SIGNATURE_HEADER]: signature }, body: text });
  return createApp({ extraRoutes: [], developmentMediaOrigin, maxFutureSkewMs: MAX_FUTURE_SKEW_MS }).fetch(request, whatsappTestEnv);
}

async function historyOf(input: { account: SeededAccount }) {
  const outcome = await inboxOf({ accountId: input.account.accountId }).getMessages({
    connection: input.account.connection,
    limit: HISTORY_LIMIT,
  });
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value.history;
}

function ownerTextsOf(input: { history: Awaited<ReturnType<typeof historyOf>> }): string[] {
  return input.history.flatMap((message) =>
    message.direction === MessageDirection.FromOwner && message.kind === MessageKind.Text ? [message.text] : [],
  );
}

function occurrencesOf(input: { text: string; event: OperatorEvent }): number {
  return input.text.split(input.event).length - 1;
}

async function storedByChannelId(input: { account: SeededAccount; channelMessageId: string }) {
  const stored = await runInDurableObject(accountInboxStub({ accountId: input.account.accountId }), (instance) =>
    (instance as unknown as { dependencies: CoreDependencies }).dependencies.repository.findMessageByChannelMessageId({
      channelMessageId: input.channelMessageId,
    }),
  );
  if (stored === null) throw new Error('the message is not stored');
  return stored;
}

function windowOf(input: { account: SeededAccount }) {
  return runInDurableObject(accountInboxStub({ accountId: input.account.accountId }), (instance) =>
    (instance as unknown as { dependencies: CoreDependencies }).dependencies.repository.findWindow(),
  );
}

async function seedAgentMessage(input: { account: SeededAccount; agent: string }): Promise<void> {
  await runInDurableObject(accountInboxStub({ accountId: input.account.accountId }), async (instance) => {
    const { repository } = (instance as unknown as { dependencies: CoreDependencies }).dependencies;
    await repository.insertMessage({
      message: buildTextMessage({ messageId: AGENT_MESSAGE_ID, agent: input.agent, delivery: DeliveryState.Sent }),
    });
    await repository.saveChannelMessageId({ messageId: AGENT_MESSAGE_ID, channelMessageId: AGENT_CHANNEL_MESSAGE_ID });
  });
}

function secondsAgo(input: { ageMs: number }): string {
  return String(Math.floor((Date.now() - input.ageMs) / SECOND_MS));
}

function fresh(input: { message: object; account: SeededAccount; id: string }): object {
  return { ...input.message, from: input.account.phone, id: input.id, timestamp: nowInSeconds() };
}

function loggedText(input: { spies: ReturnType<typeof vi.spyOn>[] }): string {
  return JSON.stringify(input.spies.flatMap((spy) => spy.mock.calls));
}

function spyOnLogs() {
  return [vi.spyOn(console, 'log'), vi.spyOn(console, 'error'), vi.spyOn(console, 'warn')];
}

function paddedNotificationOf(input: { totalBytes: number }): string {
  const json = JSON.stringify(notificationWith({}));
  return json.padEnd(input.totalBytes, ' ');
}

describe('webhook verification', () => {
  test('WI-18 answers the challenge as plain text', async () => {
    const query = `hub.mode=subscribe&hub.verify_token=${env.WHATSAPP_VERIFY_TOKEN}&hub.challenge=777`;
    const response = await SELF.fetch(`${WEBHOOK_URL}?${query}`);
    expect(response.status).toBe(STATUS_OK);
    expect(await response.text()).toBe('777');
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  test('WI-19 refuses a wrong verify token with an empty body', async () => {
    const response = await SELF.fetch(`${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=777`);
    expect(response.status).toBe(STATUS_FORBIDDEN);
    expect(await response.text()).toBe('');
  });
});

describe('webhook signature variants', () => {
  const ALGORITHM_PREFIX = 'sha256=';

  test.each([
    ['upper case hex', (hex: string) => `${ALGORITHM_PREFIX}${hex.toUpperCase()}`],
    ['no prefix', (hex: string) => hex],
    ['sha1 prefix', (hex: string) => `sha1=${hex.slice(0, 40)}`],
    ['sha512 prefix', (hex: string) => `sha512=${hex}`],
    ['digest too short', (hex: string) => `${ALGORITHM_PREFIX}${hex.slice(0, 62)}`],
    ['digest too long', (hex: string) => `${ALGORITHM_PREFIX}${hex}00`],
    ['all zero digest', () => `${ALGORITHM_PREFIX}${'0'.repeat(64)}`],
    ['empty header', () => ''],
  ])('pin: answers 401 with the same body for a signature with %s and stores nothing', async (_name, tamper) => {
    const account = await seedAccount({ agent: 'alpha' });
    const text = JSON.stringify(notificationWith({ messages: [ownerText({ account, id: 'wamid.SIGVARIANT', text: 'Oi' })] }));
    const valid = await signatureHeaderOf({ appSecret: env.META_APP_SECRET as string, body: encode({ text }) });
    const response = await SELF.fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { [WEBHOOK_SIGNATURE_HEADER]: tamper(valid.slice(ALGORITHM_PREFIX.length)) },
      body: text,
    });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual([]);
  });
});

describe('webhook request checks', () => {
  test('WI-22 answers 401 for a signature over other bytes and stores nothing', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const text = JSON.stringify(notificationWith({ messages: [ownerText({ account, id: 'wamid.BADSIG', text: 'Oi' })] }));
    const response = await postSigned({ text, signedText: `${text} ` });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual([]);
  });

  test('answers 401 without a signature header', async () => {
    const response = await SELF.fetch(WEBHOOK_URL, { method: 'POST', body: JSON.stringify(notificationWith({})) });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
  });

  test('WI-23 answers 400 for a signed body that is not JSON', async () => {
    const response = await postSigned({ text: 'not json' });
    expect(response.status).toBe(STATUS_BAD_REQUEST);
  });

  test('answers 400 for a signed JSON body without an entry array', async () => {
    const response = await postSigned({ text: JSON.stringify({ object: 'whatsapp_business_account' }) });
    expect(response.status).toBe(STATUS_BAD_REQUEST);
  });

  test('WI-24 answers 413 for a declared length over the cap', async () => {
    const text = paddedNotificationOf({ totalBytes: WEBHOOK_MAX_BYTES + 1 });
    const response = await postSigned({ text });
    expect(response.status).toBe(STATUS_PAYLOAD_TOO_LARGE);
  });

  test('WI-25 answers 413 for a chunked body over the cap', async () => {
    const chunkCount = Math.ceil((WEBHOOK_MAX_BYTES + 1) / CHUNK_BYTES);
    const chunks = Array.from({ length: chunkCount }, () => new Uint8Array(CHUNK_BYTES).fill(' '.charCodeAt(0)));
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const chunk = chunks.shift();
        if (chunk === undefined) return controller.close();
        controller.enqueue(chunk);
      },
    });
    const signedBody = new Uint8Array(chunkCount * CHUNK_BYTES).fill(' '.charCodeAt(0));
    const signature = await signatureHeaderOf({ appSecret: env.META_APP_SECRET as string, body: signedBody });
    const request = new Request(WEBHOOK_URL, {
      method: 'POST',
      headers: { [WEBHOOK_SIGNATURE_HEADER]: signature },
      body,
      duplex: 'half',
    } as RequestInit);
    const response = await SELF.fetch(request);
    expect(response.status).toBe(STATUS_PAYLOAD_TOO_LARGE);
  });

  test.each(['abc', '-1'])('accepts a signed body whose Content-Length header is %s because the streaming cap applies', async (header) => {
    const text = JSON.stringify(notificationWith({}));
    const signature = await signatureHeaderOf({ appSecret: env.META_APP_SECRET as string, body: encode({ text }) });
    const response = await SELF.fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { [WEBHOOK_SIGNATURE_HEADER]: signature, 'Content-Length': header },
      body: text,
    });
    expect(response.status).toBe(STATUS_OK);
  });

  test('answers 413 for an unsigned body over the cap before the signature check', async () => {
    const response = await SELF.fetch(WEBHOOK_URL, { method: 'POST', body: paddedNotificationOf({ totalBytes: WEBHOOK_MAX_BYTES + 1 }) });
    expect(response.status).toBe(STATUS_PAYLOAD_TOO_LARGE);
  });

  test('WI-26 accepts a signed body of exactly the cap', async () => {
    const response = await postSigned({ text: paddedNotificationOf({ totalBytes: WEBHOOK_MAX_BYTES }) });
    expect(response.status).toBe(STATUS_OK);
  });
});

describe('webhook inbound messages', () => {
  test('stores once when the same signed post arrives ten times at once', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const text = JSON.stringify(notificationWith({ messages: [ownerText({ account, id: 'wamid.TENWAY', text: 'Oi' })] }));
    const responses = await Promise.all(Array.from({ length: CONCURRENT_POSTS }, () => postSigned({ text })));
    expect(responses.map((response) => response.status)).toEqual(Array.from({ length: CONCURRENT_POSTS }, () => STATUS_OK));
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual(['Oi']);
  });

  test('WI-20 stores a signed owner text', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const response = await postNotification({
      notification: notificationWith({ messages: [ownerText({ account, id: 'wamid.WI20', text: 'Oi' })] }),
    });
    expect(response.status).toBe(STATUS_OK);
    const stored = await storedByChannelId({ account, channelMessageId: 'wamid.WI20' });
    expect(toWireMessage({ message: stored, link: null })).toMatchObject({ sender: MessageSender.Owner, verified: true, read: false });
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual(['Oi']);
    expect(isOwnerWindowOpen({ window: await windowOf({ account }), now: Date.now() })).toBe(true);
  });

  test('WI-21 stores a delivered twice webhook once', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const notification = notificationWith({ messages: [ownerText({ account, id: 'wamid.WI21', text: 'Oi' })] });
    const first = await postNotification({ notification });
    const second = await postNotification({ notification });
    expect([first.status, second.status]).toEqual([STATUS_OK, STATUS_OK]);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual(['Oi']);
  });

  test('WI-27 skips a foreign phone number id and logs it without a phone number', async () => {
    const spies = spyOnLogs();
    const account = await seedAccount({ agent: 'alpha' });
    const notification = notificationOf({
      changes: [changeOf({ phoneNumberId: FOREIGN_PHONE_NUMBER_ID, messages: [ownerText({ account, id: 'wamid.WI27', text: 'Oi' })] })],
    });
    const response = await postNotification({ notification });
    expect(response.status).toBe(STATUS_OK);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual([]);
    expect(loggedText({ spies })).toContain(OperatorEvent.InboundForeignNumber);
    expect(loggedText({ spies })).not.toContain(account.phone);
  });

  test('WI-28 skips a sender with no owner row and logs it without a phone number', async () => {
    const spies = spyOnLogs();
    const response = await postNotification({
      notification: notificationWith({ messages: [{ ...textFixture, from: UNKNOWN_PHONE, id: 'wamid.WI28', timestamp: nowInSeconds() }] }),
    });
    expect(response.status).toBe(STATUS_OK);
    expect(loggedText({ spies })).toContain(OperatorEvent.InboundUnmapped);
    expect(loggedText({ spies })).not.toContain(UNKNOWN_PHONE);
  });

  test('WI-29 keeps the text of another change when a message has an unknown type', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const notification = notificationOf({
      changes: [
        changeOf({ messages: [{ ...orderFixture, from: account.phone, id: 'wamid.WI29ORDER', timestamp: nowInSeconds() }] }),
        changeOf({ messages: [ownerText({ account, id: 'wamid.WI29TEXT', text: 'Oi' })] }),
      ],
    });
    const response = await postNotification({ notification });
    expect(response.status).toBe(STATUS_OK);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual(['Oi']);
    const screenTexts = await screenTextsOf({ account });
    expect(screenTexts.filter((text) => text === UNSUPPORTED_NOTICE)).toHaveLength(1);
  });

  test('WI-30 keeps the text beside a message without from', async () => {
    const spies = spyOnLogs();
    const account = await seedAccount({ agent: 'alpha' });
    const { from, ...withoutSender } = textFixture;
    void from;
    const notification = notificationWith({ messages: [withoutSender, ownerText({ account, id: 'wamid.WI30', text: 'Oi' })] });
    const response = await postNotification({ notification });
    expect(response.status).toBe(STATUS_OK);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual(['Oi']);
    expect(occurrencesOf({ text: loggedText({ spies }), event: OperatorEvent.InboundUnmapped })).toBe(1);
  });

  test('WI-31 stores the change of our number beside a foreign one', async () => {
    const spies = spyOnLogs();
    const account = await seedAccount({ agent: 'alpha' });
    const notification = notificationOf({
      changes: [
        changeOf({ phoneNumberId: FOREIGN_PHONE_NUMBER_ID, messages: [ownerText({ account, id: 'wamid.WI31FOREIGN', text: 'Fora' })] }),
        changeOf({ phoneNumberId: OUR_PHONE_NUMBER_ID, messages: [ownerText({ account, id: 'wamid.WI31OURS', text: 'Oi' })] }),
      ],
    });
    const response = await postNotification({ notification });
    expect(response.status).toBe(STATUS_OK);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual(['Oi']);
    expect(occurrencesOf({ text: loggedText({ spies }), event: OperatorEvent.InboundForeignNumber })).toBe(1);
  });

  test('WI-32 skips a change with another field', async () => {
    const spies = spyOnLogs();
    const account = await seedAccount({ agent: 'alpha' });
    const notification = notificationOf({
      changes: [
        changeOf({ field: 'account_alerts', phoneNumberId: null, messages: [ownerText({ account, id: 'wamid.WI32', text: 'Oi' })] }),
      ],
    });
    const response = await postNotification({ notification });
    expect(response.status).toBe(STATUS_OK);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual([]);
    expect(loggedText({ spies })).toContain(OperatorEvent.NotificationIgnoredField);
  });
});

function failFirstCommit(input: { account: SeededAccount }) {
  return runInDurableObject(accountInboxStub({ accountId: input.account.accountId }), (instance) => {
    const { repository } = (instance as unknown as { dependencies: CoreDependencies }).dependencies;
    const commit = repository.commitChannelInbound.bind(repository);
    let calls = 0;
    repository.commitChannelInbound = async (commitInput) => {
      calls += 1;
      if (calls === 1) throw new Error('injected before the commit');
      return commit(commitInput);
    };
  });
}

async function imageNotificationOf(input: {
  account: SeededAccount;
  id: string;
  sha256?: string;
  fixture?: typeof imageFixture;
}): Promise<object> {
  const { fixture = imageFixture } = input;
  const digest = await crypto.subtle.digest('SHA-256', IMAGE_BYTES);
  const matchingSha256 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  const sha256 = input.sha256 === undefined ? matchingSha256 : input.sha256;
  return notificationWith({
    messages: [{ ...fixture, from: input.account.phone, id: input.id, timestamp: nowInSeconds(), image: { ...fixture.image, sha256 } }],
  });
}

function nowInSeconds(): string {
  return String(Math.floor(Date.now() / SECOND_MS));
}

function respondWithImage(): Response {
  return new Response(IMAGE_BYTES);
}

function serveMediaFromGraph(
  input: { metadataUrl?: string; download?: DownloadScript; metadataPath?: string; metadataSize?: number; metadata?: () => Response } = {},
): GraphCall[] {
  const { metadataUrl = IMAGE_DOWNLOAD_URL, download = respondWithImage, metadataPath = IMAGE_METADATA_PATH } = input;
  const { metadataSize = IMAGE_BYTES.byteLength, metadata = () => Response.json({ url: metadataUrl, file_size: metadataSize }) } = input;
  const calls: GraphCall[] = [];
  const passthrough = globalThis.fetch.bind(globalThis);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (request, init) => {
    const url = String(request instanceof Request ? request.url : request);
    if (url.endsWith(metadataPath)) return metadata();
    if (!url.startsWith(SECURE_PREFIX)) return passthrough(request, init);
    calls.push({ url, authorization: new Headers(init?.headers).get('authorization') });
    return download({ attempt: calls.length, signal: init?.signal });
  });
  return calls;
}

function neverAnswer(input: { signal: AbortSignal | null | undefined }): Promise<Response> {
  return new Promise((_resolve, reject) => {
    input.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  });
}

function hostsOf(input: { calls: GraphCall[] }): string[] {
  return input.calls.map((call) => new URL(call.url).hostname);
}

async function imageOf(input: { account: SeededAccount }) {
  const history = await historyOf({ account: input.account });
  const images = history.flatMap((message) => (message.kind === MessageKind.Image ? [message] : []));
  expect(images).toHaveLength(1);
  return images[0]!;
}

async function storedKeysOf(input: { account: SeededAccount }): Promise<string[]> {
  const listed = await env.MEDIA.list({ prefix: `${MEDIA_KEY_PREFIX}/${input.account.accountId}/` });
  return listed.objects.map((object) => object.key);
}

async function screenTextsOf(input: { account: SeededAccount }): Promise<string[]> {
  const screen = await inboxOf({ accountId: input.account.accountId }).readScreen();
  return screen.map((entry) => entry.text);
}

function countOwnerMessages(input: { account: SeededAccount; kind: MessageKind }): Promise<number> {
  return runInDurableObject(
    accountInboxStub({ accountId: input.account.accountId }),
    (_instance, state) =>
      state.storage.sql
        .exec<{ total: number }>(
          'SELECT COUNT(*) AS total FROM inbox_messages WHERE direction = ? AND kind = ?',
          MessageDirection.FromOwner,
          input.kind,
        )
        .one().total,
  );
}

describe('webhook failures', () => {
  test('WI-33 answers 500 when the Durable Object commit fails, and the retry stores one message', async () => {
    spyOnLogs();
    const account = await seedAccount({ agent: 'alpha' });
    await failFirstCommit({ account });
    const notification = notificationWith({ messages: [ownerText({ account, id: 'wamid.WI33', text: 'Oi' })] });
    const first = await postNotification({ notification });
    expect(first.status).toBe(STATUS_SERVER_ERROR);
    expect(await countOwnerMessages({ account, kind: MessageKind.Text })).toBe(0);
    const retried = await postNotification({ notification });
    expect(retried.status).toBe(STATUS_OK);
    expect(await countOwnerMessages({ account, kind: MessageKind.Text })).toBe(1);
  });

  test('WI-34 answers 500 when the R2 put fails, and the retry stores one message', async () => {
    spyOnLogs();
    serveMediaFromGraph();
    const account = await seedAccount({ agent: 'alpha' });
    vi.spyOn(env.MEDIA, 'put').mockRejectedValueOnce(new Error('injected R2 failure'));
    const notification = await imageNotificationOf({ account, id: 'wamid.WI34' });
    const first = await postNotificationWithAccessToken({ notification });
    expect(first.status).toBe(STATUS_SERVER_ERROR);
    expect(await countOwnerMessages({ account, kind: MessageKind.Image })).toBe(0);
    const retried = await postNotificationWithAccessToken({ notification });
    expect(retried.status).toBe(STATUS_OK);
    expect(await countOwnerMessages({ account, kind: MessageKind.Image })).toBe(1);
  });
});

describe('webhook inbound media', () => {
  test('WI-35 stores an image whose digest matches, at the account prefix, with its caption', async () => {
    spyOnLogs();
    serveMediaFromGraph();
    const account = await seedAccount({ agent: 'alpha' });
    const response = await postNotificationWithAccessToken({ notification: await imageNotificationOf({ account, id: 'wamid.WI35' }) });
    expect(response.status).toBe(STATUS_OK);
    const image = await imageOf({ account });
    if (image.source.kind !== MediaSourceKind.Stored) throw new Error('the image is not stored');
    const key = `${MEDIA_KEY_PREFIX}/${account.accountId}/media/${image.source.mediaId}`;
    expect(image.caption).toBe('Foto');
    expect(image.source.mediaId).toMatch(/^med_/);
    expect(await storedKeysOf({ account })).toEqual([key]);
    expect((await env.MEDIA.head(key))?.size).toBe(IMAGE_BYTES.byteLength);
  });

  test('WI-36 stores an image whose digest differs as unavailable, deletes the object and tells the owner', async () => {
    spyOnLogs();
    serveMediaFromGraph();
    const account = await seedAccount({ agent: 'alpha' });
    const notification = await imageNotificationOf({ account, id: 'wamid.WI36', sha256: WRONG_DIGEST });
    const response = await postNotificationWithAccessToken({ notification });
    expect(response.status).toBe(STATUS_OK);
    expect((await imageOf({ account })).source.kind).toBe(MediaSourceKind.Unavailable);
    expect(await storedKeysOf({ account })).toEqual([]);
    expect(await screenTextsOf({ account })).toContain(WHATSAPP_COPY[OwnerLocale.PortugueseBrazil][OwnerCopyKey.MediaUnavailable]);
  });

  test('WI-37 refreshes the metadata after a 404 and stores the second download', async () => {
    spyOnLogs();
    const calls = serveMediaFromGraph({
      download: ({ attempt }) => (attempt === 1 ? new Response(null, { status: STATUS_NOT_FOUND }) : respondWithImage()),
    });
    const account = await seedAccount({ agent: 'alpha' });
    const response = await postNotificationWithAccessToken({ notification: await imageNotificationOf({ account, id: 'wamid.WI37' }) });
    expect(response.status).toBe(STATUS_OK);
    expect((await imageOf({ account })).source.kind).toBe(MediaSourceKind.Stored);
    expect(calls).toHaveLength(2);
  });

  test('WI-38 stores the image as unavailable when the download answers 404 twice, without a 500', async () => {
    spyOnLogs();
    serveMediaFromGraph({ download: () => new Response(null, { status: STATUS_NOT_FOUND }) });
    const account = await seedAccount({ agent: 'alpha' });
    const response = await postNotificationWithAccessToken({ notification: await imageNotificationOf({ account, id: 'wamid.WI38' }) });
    expect(response.status).toBe(STATUS_OK);
    expect((await imageOf({ account })).source.kind).toBe(MediaSourceKind.Unavailable);
  });

  test('WI-39 answers 500 when the download fails and stores once after the fake recovers', async () => {
    spyOnLogs();
    let isHealthy = false;
    serveMediaFromGraph({ download: () => (isHealthy ? respondWithImage() : new Response(null, { status: STATUS_DOWNLOAD_FAILED })) });
    const account = await seedAccount({ agent: 'alpha' });
    const notification = await imageNotificationOf({ account, id: 'wamid.WI39' });
    const first = await postNotificationWithAccessToken({ notification });
    expect(first.status).toBe(STATUS_SERVER_ERROR);
    expect(await countOwnerMessages({ account, kind: MessageKind.Image })).toBe(0);
    isHealthy = true;
    const retried = await postNotificationWithAccessToken({ notification });
    expect(retried.status).toBe(STATUS_OK);
    expect(await countOwnerMessages({ account, kind: MessageKind.Image })).toBe(1);
  });

  test('WI-40 answers 500 when the download never answers within the request timeout', async () => {
    spyOnLogs();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    serveMediaFromGraph({ download: neverAnswer });
    const account = await seedAccount({ agent: 'alpha' });
    const pending = postNotificationWithAccessToken({ notification: await imageNotificationOf({ account, id: 'wamid.WI40' }) });
    const settled = { isDone: false };
    void pending.finally(() => {
      settled.isDone = true;
    });
    await vi.waitFor(async () => {
      await vi.advanceTimersByTimeAsync(GRAPH_REQUEST_TIMEOUT_MS);
      expect(settled.isDone).toBe(true);
    });
    const response = await pending;
    vi.useRealTimers();
    expect(response.status).toBe(STATUS_SERVER_ERROR);
    expect(await countOwnerMessages({ account, kind: MessageKind.Image })).toBe(0);
  });

  test('WI-41 stores the image as unavailable when the download redirects, and never follows to the foreign host', async () => {
    spyOnLogs();
    const calls = serveMediaFromGraph({
      download: () => new Response(null, { status: STATUS_FOUND, headers: { location: FOREIGN_DOWNLOAD_URL } }),
    });
    const account = await seedAccount({ agent: 'alpha' });
    const response = await postNotificationWithAccessToken({ notification: await imageNotificationOf({ account, id: 'wamid.WI41' }) });
    expect(response.status).toBe(STATUS_OK);
    expect((await imageOf({ account })).source.kind).toBe(MediaSourceKind.Unavailable);
    expect(hostsOf({ calls })).not.toContain(FOREIGN_HOST);
  });

  test.each([
    ['WI-42', USERINFO_TRICK_URL],
    ['WI-43', PATH_TRICK_URL],
  ])('%s stores the image as unavailable and sends no request to the lookalike host', async (caseName, metadataUrl) => {
    spyOnLogs();
    const calls = serveMediaFromGraph({ metadataUrl });
    const account = await seedAccount({ agent: 'alpha' });
    const notification = await imageNotificationOf({ account, id: `wamid.${caseName}` });
    const response = await postNotificationWithAccessToken({ notification });
    expect(response.status).toBe(STATUS_OK);
    expect((await imageOf({ account })).source.kind).toBe(MediaSourceKind.Unavailable);
    expect(calls).toEqual([]);
  });
});

describe('webhook development media origin', () => {
  const DEVELOPMENT_ORIGIN = 'http://127.0.0.1:4011';
  const DEVELOPMENT_DOWNLOAD_URL = `${DEVELOPMENT_ORIGIN}/media/image`;

  test('pin: the production app never downloads from a development origin, even when the binding is set', async () => {
    spyOnLogs();
    const downloaded: string[] = [];
    const passthrough = globalThis.fetch.bind(globalThis);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (request, init) => {
      const url = String(request instanceof Request ? request.url : request);
      if (url.endsWith(IMAGE_METADATA_PATH)) return Response.json({ url: DEVELOPMENT_DOWNLOAD_URL, file_size: IMAGE_BYTES.byteLength });
      if (url.startsWith(DEVELOPMENT_ORIGIN)) downloaded.push(url);
      return passthrough(request, init);
    });
    const account = await seedAccount({ agent: 'alpha' });
    const response = await postNotificationWithAccessToken({
      notification: await imageNotificationOf({ account, id: 'wamid.DEVORIGIN' }),
    });
    expect(response.status).toBe(STATUS_OK);
    expect((await imageOf({ account })).source.kind).toBe(MediaSourceKind.Unavailable);
    expect(downloaded).toEqual([]);
  });

  test('the development app downloads from the configured development origin', async () => {
    spyOnLogs();
    const downloaded: string[] = [];
    const passthrough = globalThis.fetch.bind(globalThis);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (request, init) => {
      const url = String(request instanceof Request ? request.url : request);
      if (url.endsWith(IMAGE_METADATA_PATH)) return Response.json({ url: DEVELOPMENT_DOWNLOAD_URL, file_size: IMAGE_BYTES.byteLength });
      if (!url.startsWith(DEVELOPMENT_ORIGIN)) return passthrough(request, init);
      downloaded.push(url);
      return respondWithImage();
    });
    const account = await seedAccount({ agent: 'alpha' });
    const response = await postNotificationWithAccessToken({
      notification: await imageNotificationOf({ account, id: 'wamid.DEVORIGINOK' }),
      developmentMediaOrigin: DEVELOPMENT_ORIGIN,
    });
    expect(response.status).toBe(STATUS_OK);
    expect((await imageOf({ account })).source.kind).toBe(MediaSourceKind.Stored);
    expect(downloaded).toEqual([DEVELOPMENT_DOWNLOAD_URL]);
  });
});

describe('webhook stale and replayed deliveries', () => {
  test('answers 200, stores nothing and logs inbound.stale for an entry older than the receipt retention', async () => {
    const spies = spyOnLogs();
    const account = await seedAccount({ agent: 'alpha' });
    const message = {
      ...ownerText({ account, id: 'wamid.STALE', text: 'Velho' }),
      timestamp: secondsAgo({ ageMs: RECEIPT_RETENTION_MS + STALE_MARGIN_MS }),
    };
    const response = await postNotification({ notification: notificationWith({ messages: [message] }) });
    expect(response.status).toBe(STATUS_OK);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual([]);
    expect(occurrencesOf({ text: loggedText({ spies }), event: OperatorEvent.InboundStale })).toBe(1);
  });

  test('pin: processes an entry just inside the receipt retention', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const message = {
      ...ownerText({ account, id: 'wamid.EDGE', text: 'Quase' }),
      timestamp: secondsAgo({ ageMs: RECEIPT_RETENTION_MS - STALE_MARGIN_MS }),
    };
    const response = await postNotification({ notification: notificationWith({ messages: [message] }) });
    expect(response.status).toBe(STATUS_OK);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual(['Quase']);
  });

  test('answers 200, stores nothing and logs inbound.future for an entry timestamped beyond the future skew', async () => {
    const spies = spyOnLogs();
    const account = await seedAccount({ agent: 'alpha' });
    const message = {
      ...ownerText({ account, id: 'wamid.FUTURE', text: 'Amanha' }),
      timestamp: secondsAgo({ ageMs: -(MAX_FUTURE_SKEW_MS + STALE_MARGIN_MS) }),
    };
    const response = await postNotificationWithAccessToken({ notification: notificationWith({ messages: [message] }) });
    expect(response.status).toBe(STATUS_OK);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual([]);
    expect(occurrencesOf({ text: loggedText({ spies }), event: OperatorEvent.InboundFuture })).toBe(1);
  });

  test('pin: processes an entry just inside the future skew', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const message = {
      ...ownerText({ account, id: 'wamid.SOON', text: 'Quase' }),
      timestamp: secondsAgo({ ageMs: -(MAX_FUTURE_SKEW_MS - STALE_MARGIN_MS) }),
    };
    const response = await postNotificationWithAccessToken({ notification: notificationWith({ messages: [message] }) });
    expect(response.status).toBe(STATUS_OK);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual(['Quase']);
  });

  test('answers 200 and keeps one message when a captured delivery of a stored message id is replayed after the retention', async () => {
    spyOnLogs();
    const account = await seedAccount({ agent: 'alpha' });
    const original = ownerText({ account, id: 'wamid.REPLAY', text: 'Oi' });
    await postNotification({ notification: notificationWith({ messages: [original] }) });
    const replayed = { ...original, timestamp: secondsAgo({ ageMs: RECEIPT_RETENTION_MS + STALE_MARGIN_MS }) };
    const response = await postNotification({ notification: notificationWith({ messages: [replayed] }) });
    expect(response.status).toBe(STATUS_OK);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual(['Oi']);
  });

  test('answers 200 and keeps the stored object when a committed media message is replayed after the retention', async () => {
    spyOnLogs();
    const calls = serveMediaFromGraph();
    const account = await seedAccount({ agent: 'alpha' });
    const original = await imageNotificationOf({ account, id: 'wamid.REPLAYMEDIA' });
    await postNotificationWithAccessToken({ notification: original });
    const [message] = (original as { entry: { changes: { value: { messages: object[] } }[] }[] }).entry[0]!.changes[0]!.value.messages;
    const replayed = notificationWith({
      messages: [{ ...message, timestamp: secondsAgo({ ageMs: RECEIPT_RETENTION_MS + STALE_MARGIN_MS }) }],
    });
    const response = await postNotificationWithAccessToken({ notification: replayed });
    expect(response.status).toBe(STATUS_OK);
    expect(calls).toHaveLength(1);
    expect(await storedKeysOf({ account })).toHaveLength(1);
  });

  test('downloads nothing and keeps the stored object when a committed media message is delivered again', async () => {
    spyOnLogs();
    const calls = serveMediaFromGraph();
    const account = await seedAccount({ agent: 'alpha' });
    const notification = await imageNotificationOf({ account, id: 'wamid.REDELIVER' });
    await postNotificationWithAccessToken({ notification });
    const [keyBefore] = await storedKeysOf({ account });
    const bytesBefore = await (await env.MEDIA.get(keyBefore!))?.arrayBuffer();
    serveMediaFromGraph({ download: () => new Response(new TextEncoder().encode('different-bytes')) });
    const response = await postNotificationWithAccessToken({ notification });
    expect(response.status).toBe(STATUS_OK);
    expect(calls).toHaveLength(1);
    expect(await storedKeysOf({ account })).toEqual([keyBefore]);
    expect(await (await env.MEDIA.get(keyBefore!))?.arrayBuffer()).toEqual(bytesBefore);
    expect(await countOwnerMessages({ account, kind: MessageKind.Image })).toBe(1);
  });
});

describe('webhook Graph errors on inbound media', () => {
  test('R2 stores the media as unavailable on a too-large Graph error and still stores the text after it in the same POST', async () => {
    spyOnLogs();
    serveMediaFromGraph({
      metadata: () => Response.json({ error: { code: TOO_LARGE_CODE, message: 'too large' } }, { status: STATUS_BAD_REQUEST_GRAPH }),
    });
    const account = await seedAccount({ agent: 'alpha' });
    const image = fresh({ message: imageFixture, account, id: 'wamid.TOOLARGE' });
    const text = ownerText({ account, id: 'wamid.AFTERLARGE', text: 'Depois' });
    const response = await postNotificationWithAccessToken({ notification: notificationWith({ messages: [image, text] }) });
    expect(response.status).toBe(STATUS_OK);
    expect((await imageOf({ account })).source.kind).toBe(MediaSourceKind.Unavailable);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual(['Depois']);
    expect(await screenTextsOf({ account })).toContain(WHATSAPP_COPY[OwnerLocale.PortugueseBrazil][OwnerCopyKey.MediaUnavailable]);
  });

  test('R2 answers 500 when the metadata request answers with a server error, so Meta retries', async () => {
    spyOnLogs();
    serveMediaFromGraph({ metadata: () => new Response(null, { status: STATUS_SERVER_ERROR }) });
    const account = await seedAccount({ agent: 'alpha' });
    const response = await postNotificationWithAccessToken({ notification: await imageNotificationOf({ account, id: 'wamid.META500' }) });
    expect(response.status).toBe(STATUS_SERVER_ERROR);
    expect(await countOwnerMessages({ account, kind: MessageKind.Image })).toBe(0);
  });
});

describe('webhook forwarded messages', () => {
  test.each([
    ['a forwarded text', textForwardedFixture, ForwardedKind.Forwarded],
    ['a frequently forwarded text', textFrequentlyForwardedFixture, ForwardedKind.FrequentlyForwarded],
  ])('stores %s with the forwarded kind and verified false', async (_name, fixture, forwarded) => {
    const account = await seedAccount({ agent: 'alpha' });
    const id = `wamid.${forwarded}`;
    const message = fresh({ message: fixture, account, id });
    const response = await postNotification({ notification: notificationWith({ messages: [message] }) });
    expect(response.status).toBe(STATUS_OK);
    const stored = await storedByChannelId({ account, channelMessageId: id });
    expect(toWireMessage({ message: stored, link: null })).toMatchObject({
      sender: MessageSender.Owner,
      verified: false,
      read: false,
      forwarded,
    });
  });

  test('stores a forwarded image with its media and the forwarded kind', async () => {
    spyOnLogs();
    serveMediaFromGraph();
    const account = await seedAccount({ agent: 'alpha' });
    const notification = await imageNotificationOf({ account, id: 'wamid.FWDIMAGE', fixture: imageForwardedFixture });
    const response = await postNotificationWithAccessToken({ notification });
    expect(response.status).toBe(STATUS_OK);
    const image = await imageOf({ account });
    expect(image.source.kind).toBe(MediaSourceKind.Stored);
    expect(image.forwarded).toBe(ForwardedKind.Forwarded);
  });

  test('a plain text is stored with forwarded none and verified true', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    await postNotification({ notification: notificationWith({ messages: [ownerText({ account, id: 'wamid.PLAIN', text: 'Oi' })] }) });
    const stored = await storedByChannelId({ account, channelMessageId: 'wamid.PLAIN' });
    expect(toWireMessage({ message: stored, link: null })).toMatchObject({ verified: true, forwarded: ForwardedKind.None });
  });
});

describe('webhook inbound kinds', () => {
  test('WI-44 stores a voice note as an audio message with voice true', async () => {
    spyOnLogs();
    const digest = await crypto.subtle.digest('SHA-256', VOICE_BYTES);
    const sha256 = btoa(String.fromCharCode(...new Uint8Array(digest)));
    serveMediaFromGraph({
      metadataPath: `/${audioVoiceFixture.audio.id}`,
      metadataSize: VOICE_BYTES.byteLength,
      download: () => new Response(VOICE_BYTES),
    });
    const account = await seedAccount({ agent: 'alpha' });
    const message = { ...fresh({ message: audioVoiceFixture, account, id: 'wamid.WI44' }), audio: { ...audioVoiceFixture.audio, sha256 } };
    const response = await postNotificationWithAccessToken({ notification: notificationWith({ messages: [message] }) });
    expect(response.status).toBe(STATUS_OK);
    const [stored] = await historyOf({ account });
    expect(stored).toMatchObject({ kind: MessageKind.Audio, voice: true, source: { kind: MediaSourceKind.Stored } });
  });

  test('WI-45 routes a reaction on an agent message to that agent and keeps the window closed', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    await seedAgentMessage({ account, agent: 'alpha' });
    const message = {
      ...fresh({ message: reactionFixture, account, id: 'wamid.WI45' }),
      reaction: { message_id: AGENT_CHANNEL_MESSAGE_ID, emoji: '👍' },
    };
    const response = await postNotification({ notification: notificationWith({ messages: [message] }) });
    expect(response.status).toBe(STATUS_OK);
    const reactions = (await historyOf({ account })).filter((stored) => stored.kind === MessageKind.Reaction);
    expect(reactions).toMatchObject([{ agent: 'alpha', emoji: '👍', targetMessageId: AGENT_MESSAGE_ID }]);
    expect(isOwnerWindowOpen({ window: await windowOf({ account }), now: Date.now() })).toBe(false);
  });

  test('WI-46 a quick-reply tap stores no message, opens the window and sends the queued message once', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const queued = await inboxOf({ accountId: account.accountId }).sendText({
      connection: account.connection,
      text: 'fila',
      replyToMessageId: null,
    });
    expect(queued).toMatchObject({ ok: true, value: { delivery: DeliveryState.Queued } });
    const response = await postNotification({
      notification: notificationWith({ messages: [fresh({ message: buttonFixture, account, id: 'wamid.WI46' })] }),
    });
    expect(response.status).toBe(STATUS_OK);
    expect(await countOwnerMessages({ account, kind: MessageKind.Text })).toBe(0);
    expect(isOwnerWindowOpen({ window: await windowOf({ account }), now: Date.now() })).toBe(true);
    expect((await screenTextsOf({ account })).filter((text) => text === 'fila')).toHaveLength(1);
  });

  test('WI-47 an unsupported poll opens the window and tells the owner once', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const response = await postNotification({
      notification: notificationWith({ messages: [fresh({ message: unsupportedFixture, account, id: 'wamid.WI47' })] }),
    });
    expect(response.status).toBe(STATUS_OK);
    expect(isOwnerWindowOpen({ window: await windowOf({ account }), now: Date.now() })).toBe(true);
    expect((await screenTextsOf({ account })).filter((text) => text === UNSUPPORTED_NOTICE)).toHaveLength(1);
    expect(await historyOf({ account })).toEqual([]);
  });

  test('WI-48 a text with the context id of an agent message replies to it and routes to its agent', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    await seedAgentMessage({ account, agent: 'alpha' });
    const message = {
      ...fresh({ message: textReplyFixture, account, id: 'wamid.WI48' }),
      context: { id: AGENT_CHANNEL_MESSAGE_ID },
    };
    const response = await postNotification({ notification: notificationWith({ messages: [message] }) });
    expect(response.status).toBe(STATUS_OK);
    const replies = (await historyOf({ account })).filter((stored) => stored.direction === MessageDirection.FromOwner);
    expect(replies).toMatchObject([{ agent: 'alpha', replyToMessageId: AGENT_MESSAGE_ID }]);
  });

  test('WI-49 a list reply answers the open question with the chosen option index', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    await postNotification({ notification: notificationWith({ messages: [ownerText({ account, id: 'wamid.WI49OPEN', text: 'Oi' })] }) });
    const asked = await inboxOf({ accountId: account.accountId }).ask({
      connection: account.connection,
      text: 'Qual?',
      options: ['Um', 'Dois', 'Tres', 'Quatro'],
      optionDescriptions: [null, null, null, null],
      timeoutMs: 50,
    });
    if (!asked.ok || !('questionId' in asked.value)) throw new Error('the question is not pending');
    const { questionId } = asked.value;
    const message = {
      ...fresh({ message: listReplyFixture, account, id: 'wamid.WI49' }),
      interactive: { type: 'list_reply', list_reply: { id: formatOptionId({ questionId, optionIndex: 1 }), title: 'Dois' } },
    };
    const response = await postNotification({ notification: notificationWith({ messages: [message] }) });
    expect(response.status).toBe(STATUS_OK);
    const answer = await runInDurableObject(accountInboxStub({ accountId: account.accountId }), (instance) =>
      (instance as unknown as { dependencies: CoreDependencies }).dependencies.repository.findQuestion({ questionId }),
    );
    expect(answer?.answer).toMatchObject({ optionIndex: 1, text: 'Dois' });
  });
});
