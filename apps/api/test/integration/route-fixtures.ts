import { env } from 'cloudflare:test';
import type { ConnectionIdentity } from '@zapbip/core';
import { LinkPurpose, MINUTE_MS, OwnerLocale } from '@zapbip/types';
import { hashConnectionSecret } from '../../src/adapters/platform/hash';
import type { DevAccountInboxRpc } from '../../src/contract/account-inbox-rpc';
import { CONNECTION_SECRET_PREFIX } from '../../src/contract/constants';
import type { Bindings } from '../../src/contract/env';
import { signLink } from '../../src/signing';

declare global {
  namespace Cloudflare {
    interface Env extends Bindings {}
  }
}

export const ORIGIN = 'http://example.com';
export const LINK_VALIDITY_MS = 15 * MINUTE_MS;

const SCHEMA_STATEMENTS = [
  'CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS connections (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, agent TEXT NOT NULL, secret_digest TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, UNIQUE (account_id, agent))',
  'CREATE TABLE IF NOT EXISTS owner_identities (wa_id TEXT PRIMARY KEY, account_id TEXT NOT NULL UNIQUE, from_user_id TEXT, locale TEXT NOT NULL, created_at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS message_index (wamid TEXT PRIMARY KEY, account_id TEXT NOT NULL, created_at INTEGER NOT NULL)',
];

const SECRET_BODY_BYTES = 32;
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

export async function seedAccount(input: { agent: string }): Promise<SeededAccount> {
  await env.CONNECTIONS.batch(SCHEMA_STATEMENTS.map((statement) => env.CONNECTIONS.prepare(statement)));
  const accountId = `acc_${crypto.randomUUID()}`;
  const phone = `${PHONE_PREFIX}${randomDigits(PHONE_SUFFIX_DIGITS)}`;
  const secret = randomSecret();
  const secretDigest = await hashConnectionSecret({ secret });
  const now = Date.now();
  await env.CONNECTIONS.batch([
    env.CONNECTIONS.prepare('INSERT INTO accounts (id, created_at) VALUES (?, ?)').bind(accountId, now),
    env.CONNECTIONS.prepare(
      'INSERT INTO owner_identities (wa_id, account_id, from_user_id, locale, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(phone, accountId, null, OwnerLocale.PortugueseBrazil, now),
    env.CONNECTIONS.prepare('INSERT INTO connections (id, account_id, agent, secret_digest, created_at) VALUES (?, ?, ?, ?, ?)').bind(
      `con_${crypto.randomUUID()}`,
      accountId,
      input.agent,
      secretDigest,
      now,
    ),
  ]);
  return { accountId, phone, secret, connection: { accountId, agent: input.agent, ownerLocale: OwnerLocale.PortugueseBrazil } };
}

export function inboxOf(input: { accountId: string }): DevAccountInboxRpc {
  const stub = env.ACCOUNT_INBOX.get(env.ACCOUNT_INBOX.idFromName(input.accountId));
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
