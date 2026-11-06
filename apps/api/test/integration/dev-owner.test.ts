import { env, SELF } from 'cloudflare:test';
import { WINDOW_MS } from '@zapbip/core';
import { DeliveryState, MessageDirection, MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { inboxOf, ORIGIN, seedAccount, type SeededAccount } from './route-fixtures';

const STATUS_OK = 200;
const STATUS_BAD_REQUEST = 400;
const STATUS_NOT_FOUND = 404;
const UNKNOWN_PHONE = '5500000000000';
const MALFORMED_PHONE = 'abc';
const IMAGE_BYTES_BASE64 = btoa('image-bytes');
const IMAGE_TYPE = 'image/png';
const STICKER_TYPE = 'image/webp';
const HISTORY_LIMIT = 50;

type OwnerMessageResult = { message_id: string | null; agent: string | null; duplicate: boolean };

async function postOwner(input: { phone: string; body: Record<string, unknown> }): Promise<Response> {
  return SELF.fetch(`${ORIGIN}/dev/owner/${input.phone}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input.body),
  });
}

async function listMessages(input: { account: SeededAccount }) {
  const outcome = await inboxOf({ accountId: input.account.accountId }).getMessages({
    connection: input.account.connection,
    limit: HISTORY_LIMIT,
  });
  if (!outcome.ok) throw new Error(outcome.message);
  return [...outcome.value.history, ...outcome.value.unread];
}

async function seedListeningAccount(): Promise<{ account: SeededAccount; agentMessageId: string }> {
  const account = await seedAccount({ agent: 'alpha' });
  const outcome = await inboxOf({ accountId: account.accountId }).sendText({
    connection: account.connection,
    text: 'ola',
    replyToMessageId: null,
  });
  if (!outcome.ok) throw new Error(outcome.message);
  return { account, agentMessageId: outcome.value.messageId };
}

describe('owner simulator', () => {
  test('WI-91 owner text reaches the agent that wrote last', async () => {
    const { account } = await seedListeningAccount();
    const response = await postOwner({ phone: account.phone, body: { kind: MessageKind.Text, text: 'oi' } });
    expect(response.status).toBe(STATUS_OK);
    const messages = await listMessages({ account });
    expect(messages.filter((message) => message.direction === MessageDirection.FromOwner)).toMatchObject([
      { kind: MessageKind.Text, text: 'oi' },
    ]);
  });

  test.each([
    { kind: MessageKind.Image, mimeType: IMAGE_TYPE, voice: false },
    { kind: MessageKind.Video, mimeType: 'video/mp4', voice: false },
    { kind: MessageKind.Audio, mimeType: 'audio/ogg', voice: true },
    { kind: MessageKind.Audio, mimeType: 'audio/mpeg', voice: false },
    { kind: MessageKind.Document, mimeType: 'application/pdf', voice: false },
    { kind: MessageKind.Sticker, mimeType: STICKER_TYPE, voice: false },
  ])('WI-92 WI-94 WI-95 owner $kind (voice $voice) is stored under its wamid', async ({ kind, mimeType, voice }) => {
    const { account } = await seedListeningAccount();
    const wamid = `wamid.${crypto.randomUUID()}`;
    const response = await postOwner({
      phone: account.phone,
      body: { kind, wamid, mime_type: mimeType, data_base64: IMAGE_BYTES_BASE64, voice },
    });
    expect(response.status).toBe(STATUS_OK);
    expect(await env.MEDIA.head(`accounts/${account.accountId}/media/${wamid}`)).not.toBeNull();
    const stored = (await listMessages({ account })).filter((message) => message.direction === MessageDirection.FromOwner);
    expect(stored).toMatchObject([{ kind }]);
  });

  test('WI-96 owner location and contact card are stored with their fields', async () => {
    const { account } = await seedListeningAccount();
    await postOwner({
      phone: account.phone,
      body: { kind: MessageKind.Location, latitude: -23.5, longitude: -46.6, name: 'Casa', address: null },
    });
    await postOwner({
      phone: account.phone,
      body: { kind: MessageKind.Contacts, contacts: [{ name: 'Maria', phones: ['5511999990001'] }] },
    });
    const stored = (await listMessages({ account })).filter((message) => message.direction === MessageDirection.FromOwner);
    expect(stored).toMatchObject([
      { kind: MessageKind.Location, latitude: -23.5, longitude: -46.6, name: 'Casa' },
      { kind: MessageKind.Contacts, contacts: [{ name: 'Maria', phones: ['5511999990001'], organization: null }] },
    ]);
  });

  test('WI-97 owner reaction to an agent message is routed to that agent', async () => {
    const { account, agentMessageId } = await seedListeningAccount();
    const response = await postOwner({
      phone: account.phone,
      body: { kind: MessageKind.Reaction, target_message_id: agentMessageId, emoji: '👍' },
    });
    const result = (await response.json()) as OwnerMessageResult;
    expect(result.agent).toBe(account.connection.agent);
  });

  test('WI-98 owner reaction does not open the window', async () => {
    const { account, agentMessageId } = await seedListeningAccount();
    const inbox = inboxOf({ accountId: account.accountId });
    await inbox.advanceClock({ advanceMs: WINDOW_MS });
    await inbox.sendText({ connection: account.connection, text: 'fila', replyToMessageId: null });
    await postOwner({ phone: account.phone, body: { kind: MessageKind.Reaction, target_message_id: agentMessageId, emoji: '👍' } });
    const queued = (await listMessages({ account })).filter((message) => message.kind === MessageKind.Text && message.text === 'fila');
    expect(queued).toMatchObject([{ delivery: DeliveryState.Queued }]);
  });

  test('WI-99 owner quoted reply keeps its reply_to and goes to the quoted message agent', async () => {
    const { account, agentMessageId } = await seedListeningAccount();
    const response = await postOwner({ phone: account.phone, body: { kind: MessageKind.Text, text: 'sim', reply_to: agentMessageId } });
    const result = (await response.json()) as OwnerMessageResult;
    expect(result.agent).toBe(account.connection.agent);
    const stored = (await listMessages({ account })).filter((message) => message.direction === MessageDirection.FromOwner);
    expect(stored).toMatchObject([{ replyToMessageId: agentMessageId }]);
  });

  test('WI-101 owner choice with a malformed option id answers 200 and routes as text', async () => {
    const { account } = await seedListeningAccount();
    const response = await postOwner({ phone: account.phone, body: { kind: MessageKind.Choice, option_id: 'garbage', title: 'Sim' } });
    expect(response.status).toBe(STATUS_OK);
    const result = (await response.json()) as OwnerMessageResult;
    expect(result.agent).toBe(account.connection.agent);
  });

  test('WI-103 a duplicate wamid answers 200 with duplicate true and stores one message', async () => {
    const { account } = await seedListeningAccount();
    const body = { kind: MessageKind.Text, text: 'uma vez', wamid: `wamid.${crypto.randomUUID()}` };
    const first = (await (await postOwner({ phone: account.phone, body })).json()) as OwnerMessageResult;
    const secondResponse = await postOwner({ phone: account.phone, body });
    const second = (await secondResponse.json()) as OwnerMessageResult;
    expect(secondResponse.status).toBe(STATUS_OK);
    expect([first.duplicate, second.duplicate]).toEqual([false, true]);
    const stored = (await listMessages({ account })).filter((message) => message.kind === MessageKind.Text && message.text === 'uma vez');
    expect(stored).toHaveLength(1);
  });

  test('WI-104 the screen lists what the agent sent', async () => {
    const { account } = await seedListeningAccount();
    const response = await SELF.fetch(`${ORIGIN}/dev/owner/${account.phone}/screen`);
    expect(response.status).toBe(STATUS_OK);
    expect(await response.json()).toMatchObject({ entries: [{ text: 'ola' }] });
  });

  test('WI-105 the clock route moves the clock so the next send is queued', async () => {
    const { account } = await seedListeningAccount();
    const response = await SELF.fetch(`${ORIGIN}/dev/owner/${account.phone}/clock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ advance_ms: WINDOW_MS }),
    });
    expect(response.status).toBe(STATUS_OK);
    const outcome = await inboxOf({ accountId: account.accountId }).sendText({
      connection: account.connection,
      text: 'tarde',
      replyToMessageId: null,
    });
    expect(outcome.ok && outcome.value.delivery).toBe(DeliveryState.Queued);
  });

  test('WI-106 an unknown phone answers 404', async () => {
    const response = await postOwner({ phone: UNKNOWN_PHONE, body: { kind: MessageKind.Text, text: 'oi' } });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test('WI-107 a malformed phone answers 404', async () => {
    const response = await postOwner({ phone: MALFORMED_PHONE, body: { kind: MessageKind.Text, text: 'oi' } });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test('WI-108 a sticker that is not webp answers 400 naming mime_type', async () => {
    const { account } = await seedListeningAccount();
    const response = await postOwner({
      phone: account.phone,
      body: { kind: MessageKind.Sticker, mime_type: IMAGE_TYPE, data_base64: IMAGE_BYTES_BASE64 },
    });
    expect(response.status).toBe(STATUS_BAD_REQUEST);
    expect(await response.json()).toMatchObject({ error: 'invalid_input', message: expect.stringContaining('mime_type') });
  });
});
