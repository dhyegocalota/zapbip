import { AccountState, CLIENT_APP_TOKEN_BYTES } from '@zapbip/types';
import { encodeBase64Url } from '../adapters/platform/encoding';
import { sha256Hex } from '../adapters/platform/hash';
import { SESSION_TTL_MS } from './client-app-constants';
import type { ClientAppSession } from './client-app-env';

export type SessionRecord = Omit<ClientAppSession, 'csrfToken'>;

const INSERT_SESSION_STATEMENT = 'INSERT INTO client_app_sessions (session_digest, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)';
const DELETE_SESSION_STATEMENT = 'DELETE FROM client_app_sessions WHERE session_digest = ?';
const FIND_SESSION_STATEMENT = `SELECT accounts.id AS accountId, accounts.state AS state, owner_identities.wa_id AS waId, owner_identities.locale AS locale
  FROM client_app_sessions
  JOIN accounts ON accounts.id = client_app_sessions.account_id
  JOIN owner_identities ON owner_identities.account_id = accounts.id
  WHERE client_app_sessions.session_digest = ? AND client_app_sessions.expires_at > ? AND accounts.state IN (?, ?)`;

export async function createSession(input: { database: D1Database; accountId: string; now: number }): Promise<string> {
  const token = encodeBase64Url({ bytes: crypto.getRandomValues(new Uint8Array(CLIENT_APP_TOKEN_BYTES)) });
  const digest = await sha256Hex({ value: token });
  await input.database
    .prepare(INSERT_SESSION_STATEMENT)
    .bind(digest, input.accountId, input.now, input.now + SESSION_TTL_MS)
    .run();
  return token;
}

export async function findSession(input: { database: D1Database; token: string; now: number }): Promise<SessionRecord | null> {
  const digest = await sha256Hex({ value: input.token });
  const row = await input.database
    .prepare(FIND_SESSION_STATEMENT)
    .bind(digest, input.now, AccountState.Waitlisted, AccountState.Active)
    .first<Omit<SessionRecord, 'sessionToken'>>();
  if (row === null) return null;
  return { ...row, sessionToken: input.token };
}

export async function deleteSession(input: { database: D1Database; token: string }): Promise<void> {
  const digest = await sha256Hex({ value: input.token });
  await input.database.prepare(DELETE_SESSION_STATEMENT).bind(digest).run();
}
