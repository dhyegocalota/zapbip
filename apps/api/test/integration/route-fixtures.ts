import type { ConnectionIdentity } from '@zapbip/core';
import { LinkPurpose, MINUTE_MS, OwnerLocale } from '@zapbip/types';
import type { DevAccountInboxRpc } from '../../src/contract/account-inbox-rpc';
import { CONNECTION_SECRET_PREFIX } from '../../src/contract/constants';
import { signLink } from '../../src/signing';
import { runInDurableObject } from 'cloudflare:test';
import { createSqliteFirstMessageClaim } from '../../src/account-inbox/first-message-claim';
import { accountInboxStub } from '../support/workers-env';
import { applyDirectoryMigration, seedConnection, seedOwnerIdentity } from '../support/seed';

export const ORIGIN = 'http://example.com';
export const LINK_VALIDITY_MS = 15 * MINUTE_MS;

const SECRET_BODY_BYTES = 32;
const SEED_FIRST_MESSAGE_ID = 'wamid.seed.first';
const PHONE_PREFIX = '55119';
const PHONE_SUFFIX_DIGITS = 8;

export type SeededAccount = {
  accountId: string;
  phone: string;
  secret: string;
  connection: ConnectionIdentity;
};

export type SignedLinkQuery = { expiresAt: number; signature: string };

function randomDigits(count: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(count)), (value) => String(value % 10)).join('');
}

function randomSecret(): string {
  const body = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(SECRET_BODY_BYTES))))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  return `${CONNECTION_SECRET_PREFIX}${body}`;
}

const directoryMigration = applyDirectoryMigration();

export async function seedAccount(input: { agent: string }): Promise<SeededAccount> {
  await directoryMigration;
  const accountId = `acc_${crypto.randomUUID()}`;
  const phone = `${PHONE_PREFIX}${randomDigits(PHONE_SUFFIX_DIGITS)}`;
  const secret = randomSecret();
  await seedOwnerIdentity({ accountId, phone, ownerLocale: OwnerLocale.PortugueseBrazil });
  await seedConnection({ accountId, agent: input.agent, secret });
  await runInDurableObject(accountInboxStub({ accountId }), (_instance, state) =>
    createSqliteFirstMessageClaim({ storage: state.storage }).claim({ channelMessageId: SEED_FIRST_MESSAGE_ID }),
  );
  return { accountId, phone, secret, connection: { accountId, agent: input.agent, ownerLocale: OwnerLocale.PortugueseBrazil } };
}

export function inboxOf(input: { accountId: string }): DevAccountInboxRpc {
  const stub = accountInboxStub({ accountId: input.accountId });
  return stub as unknown as DevAccountInboxRpc;
}

export async function signedQuery(input: {
  key: string;
  accountId: string;
  mediaId: string;
  purpose: LinkPurpose;
  expiresAt: number;
}): Promise<SignedLinkQuery> {
  return { expiresAt: input.expiresAt, signature: await signLink(input) };
}

export function queryOf(input: SignedLinkQuery): string {
  return `exp=${input.expiresAt}&sig=${input.signature}`;
}

export function freshExpiry(): number {
  return Date.now() + LINK_VALIDITY_MS;
}
