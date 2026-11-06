import { env, SELF } from 'cloudflare:test';
import { HISTORY_LIMIT } from '@zapbip/core';
import { MessageDirection, MessageKind } from '@zapbip/types';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { WEBHOOK_MAX_BYTES, WEBHOOK_SIGNATURE_HEADER } from '../../src/adapters/whatsapp/whatsapp-constants';
import { OperatorEvent } from '../../src/adapters/whatsapp/whatsapp-enums';
import { WHATSAPP_WEBHOOK_PATH } from '../../src/contract/constants';
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
import { inboxOf, ORIGIN, seedAccount, type SeededAccount } from './route-fixtures';

const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_PAYLOAD_TOO_LARGE = 413;
const WEBHOOK_URL = `${ORIGIN}${WHATSAPP_WEBHOOK_PATH}`;
const CHUNK_BYTES = 64_000;
const UNKNOWN_PHONE = '5511900000099';

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

  test('WI-28 skips a sender with no owner row and logs it without a phone number', async () => {
    const spies = spyOnLogs();
    const response = await postNotification({
      notification: notificationWith({ messages: [{ ...textFixture, from: UNKNOWN_PHONE, id: 'wamid.WI28' }] }),
    });
    expect(response.status).toBe(STATUS_OK);
    expect(loggedText({ spies })).toContain(OperatorEvent.InboundUnmapped);
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
    const account = await seedAccount({ agent: 'alpha' });
    const notification = notificationOf({
      changes: [
        changeOf({ field: 'account_alerts', phoneNumberId: null, messages: [ownerText({ account, id: 'wamid.WI32', text: 'Oi' })] }),
      ],
    });
    const response = await postNotification({ notification });
    expect(response.status).toBe(STATUS_OK);
    expect(ownerTextsOf({ history: await historyOf({ account }) })).toEqual([]);
  });
});
