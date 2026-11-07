import { SELF } from 'cloudflare:test';
import { HISTORY_LIMIT } from '@zapbip/core';
import { MessageDirection, MessageKind, SECOND_MS } from '@zapbip/types';
import { WEBHOOK_SIGNATURE_HEADER } from '../../src/adapters/whatsapp/whatsapp-constants';
import { WHATSAPP_WEBHOOK_PATH } from '../../src/contract/constants';
import textFixture from '../fixtures/whatsapp/inbound/text.json';
import { signatureHeaderOf } from '../fixtures/whatsapp/inbound/signed-webhook';
import { inboxOf, ORIGIN, type SeededAccount } from './route-fixtures';

const WEBHOOK_URL = `${ORIGIN}${WHATSAPP_WEBHOOK_PATH}`;

export function nowInSeconds(): string {
  return String(Math.floor(Date.now() / SECOND_MS));
}

export function ownerText(input: { account: SeededAccount; id: string }): object {
  return { ...textFixture, from: input.account.phone, id: input.id, timestamp: nowInSeconds(), text: { body: 'Oi' } };
}

export async function postSignedWith(input: { appSecret: string; notification: object }): Promise<Response> {
  const text = JSON.stringify(input.notification);
  const signature = await signatureHeaderOf({ appSecret: input.appSecret, body: new TextEncoder().encode(text) });
  return SELF.fetch(WEBHOOK_URL, { method: 'POST', headers: { [WEBHOOK_SIGNATURE_HEADER]: signature }, body: text });
}

export async function ownerTextsOf(input: { account: SeededAccount }): Promise<string[]> {
  const outcome = await inboxOf({ accountId: input.account.accountId }).getMessages({
    connection: input.account.connection,
    limit: HISTORY_LIMIT,
  });
  if (!outcome.ok) throw new Error(outcome.message);
  return outcome.value.history.flatMap((message) =>
    message.direction === MessageDirection.FromOwner && message.kind === MessageKind.Text ? [message.text] : [],
  );
}
