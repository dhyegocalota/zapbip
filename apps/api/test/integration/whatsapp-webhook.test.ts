import { env, runInDurableObject, SELF } from 'cloudflare:test';
import { HISTORY_LIMIT, type CoreDependencies } from '@zapbip/core';
import { MediaSourceKind, MessageDirection, MessageKind, OwnerLocale, SECOND_MS } from '@zapbip/types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApp } from '../../src/app';
import { GRAPH_REQUEST_TIMEOUT_MS, WEBHOOK_MAX_BYTES, WEBHOOK_SIGNATURE_HEADER } from '../../src/adapters/whatsapp/whatsapp-constants';
import { OwnerCopyKey, WHATSAPP_COPY } from '../../src/adapters/whatsapp/whatsapp-copy';
import { OperatorEvent } from '../../src/adapters/whatsapp/whatsapp-enums';
import { WHATSAPP_WEBHOOK_PATH } from '../../src/contract/constants';
import imageFixture from '../fixtures/whatsapp/inbound/image.json';
import { LogEvent } from '../../src/contract/log';
import orderFixture from '../fixtures/whatsapp/inbound/order.json';
import textFixture from '../fixtures/whatsapp/inbound/text.json';
import {
  changeOf,
  FOREIGN_PHONE_NUMBER_ID,
  notificationOf,
  notificationWith,
  OUR_PHONE_NUMBER_ID,
} from '../fixtures/whatsapp/inbound/notification';
import { signatureHeaderOf } from '../fixtures/whatsapp/inbound/signed-webhook';
import { accountInboxStub, whatsappTestEnv } from '../support/workers-env';
import { inboxOf, ORIGIN, seedAccount, type SeededAccount } from './route-fixtures';

const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_PAYLOAD_TOO_LARGE = 413;
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

type GraphCall = { url: string; authorization: string | null };
type DownloadScript = (input: { attempt: number; signal: AbortSignal | null | undefined }) => Response | Promise<Response>;

afterEach(() => {
  vi.restoreAllMocks();
});

function encode(input: { text: string }): Uint8Array {
  return new TextEncoder().encode(input.text);
}

function ownerText(input: { account: SeededAccount; id: string; text: string }): object {
  return { ...textFixture, from: input.account.phone, id: input.id, text: { body: input.text } };
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

async function postNotificationWithAccessToken(input: { notification: object }): Promise<Response> {
  const text = JSON.stringify(input.notification);
  const signature = await signatureHeaderOf({ appSecret: env.META_APP_SECRET as string, body: encode({ text }) });
  const request = new Request(WEBHOOK_URL, { method: 'POST', headers: { [WEBHOOK_SIGNATURE_HEADER]: signature }, body: text });
  return createApp({ extraRoutes: [] }).fetch(request, whatsappTestEnv);
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
  });

  test('WI-19 refuses a wrong verify token with an empty body', async () => {
    const response = await SELF.fetch(`${WEBHOOK_URL}?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=777`);
    expect(response.status).toBe(STATUS_FORBIDDEN);
    expect(await response.text()).toBe('');
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
    const signature = await signatureHeaderOf({ appSecret: env.META_APP_SECRET as string, body: new Uint8Array(0) });
    const request = new Request(WEBHOOK_URL, {
      method: 'POST',
      headers: { [WEBHOOK_SIGNATURE_HEADER]: signature },
      body,
      duplex: 'half',
    } as RequestInit);
    const response = await SELF.fetch(request);
    expect(response.status).toBe(STATUS_PAYLOAD_TOO_LARGE);
  });

  test('WI-26 accepts a signed body of exactly the cap', async () => {
    const response = await postSigned({ text: paddedNotificationOf({ totalBytes: WEBHOOK_MAX_BYTES }) });
    expect(response.status).toBe(STATUS_OK);
  });
});

describe('webhook inbound messages', () => {
  test('WI-20 stores a signed owner text', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const response = await postNotification({
      notification: notificationWith({ messages: [ownerText({ account, id: 'wamid.WI20', text: 'Oi' })] }),
    });
    expect(response.status).toBe(STATUS_OK);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual(['Oi']);
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

  test('WI-28 opens an account for a sender with no owner row and logs it without a phone number', async () => {
    const spies = spyOnLogs();
    const response = await postNotification({
      notification: notificationWith({ messages: [{ ...textFixture, from: UNKNOWN_PHONE, id: 'wamid.WI28' }] }),
    });
    expect(response.status).toBe(STATUS_OK);
    expect(loggedText({ spies })).toContain(LogEvent.AccountCreated);
    expect(loggedText({ spies })).not.toContain(UNKNOWN_PHONE);
  });

  test('WI-29 keeps the text of another change when a message has an unknown type', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const notification = notificationOf({
      changes: [
        changeOf({ messages: [{ ...orderFixture, from: account.phone, id: 'wamid.WI29ORDER' }] }),
        changeOf({ messages: [ownerText({ account, id: 'wamid.WI29TEXT', text: 'Oi' })] }),
      ],
    });
    const response = await postNotification({ notification });
    expect(response.status).toBe(STATUS_OK);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual(['Oi']);
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
    expect(loggedText({ spies })).toContain(OperatorEvent.InboundUnmapped);
  });

  test('WI-31 stores the change of our number beside a foreign one', async () => {
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

async function imageNotificationOf(input: { account: SeededAccount; id: string; sha256?: string }): Promise<object> {
  const digest = await crypto.subtle.digest('SHA-256', IMAGE_BYTES);
  const matchingSha256 = btoa(String.fromCharCode(...new Uint8Array(digest)));
  const sha256 = input.sha256 === undefined ? matchingSha256 : input.sha256;
  return notificationWith({
    messages: [
      { ...imageFixture, from: input.account.phone, id: input.id, timestamp: nowInSeconds(), image: { ...imageFixture.image, sha256 } },
    ],
  });
}

function nowInSeconds(): string {
  return String(Math.floor(Date.now() / SECOND_MS));
}

function respondWithImage(): Response {
  return new Response(IMAGE_BYTES);
}

function serveMediaFromGraph(input: { metadataUrl?: string; download?: DownloadScript } = {}): GraphCall[] {
  const { metadataUrl = IMAGE_DOWNLOAD_URL, download = respondWithImage } = input;
  const calls: GraphCall[] = [];
  const passthrough = globalThis.fetch.bind(globalThis);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (request, init) => {
    const url = String(request instanceof Request ? request.url : request);
    if (url.endsWith(IMAGE_METADATA_PATH)) return Response.json({ url: metadataUrl, file_size: IMAGE_BYTES.byteLength });
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
    await vi.advanceTimersByTimeAsync(GRAPH_REQUEST_TIMEOUT_MS);
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
