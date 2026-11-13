import { AccountState, CLIENT_APP_TOKEN_BYTES } from '@zapbip/types';
import { encodeBase64Url } from '../adapters/platform/encoding';
import { sha256Hex } from '../adapters/platform/hash';
import { SESSION_TTL_MS } from './client-app-constants';
import type { ClientAppSession } from './client-app-env';

export type SessionRecord = Omit<ClientAppSession, 'csrfToken'>;

const INSERTED_ROW = 1;
const DELETE_ACCOUNT_SESSIONS_STATEMENT = 'DELETE FROM client_app_sessions WHERE account_id = ?';
const INSERT_SESSION_STATEMENT = `INSERT INTO client_app_sessions (session_digest, account_id, created_at, expires_at)
  SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM accounts WHERE id = ? AND state IN (?, ?))`;
const FIND_SESSION_STATEMENT = `SELECT accounts.id AS accountId, accounts.state AS state, owner_identities.wa_id AS waId, owner_identities.locale AS locale
  FROM client_app_sessions
  JOIN accounts ON accounts.id = client_app_sessions.account_id
  JOIN owner_identities ON owner_identities.account_id = accounts.id
  WHERE client_app_sessions.session_digest = ? AND client_app_sessions.expires_at > ? AND accounts.state IN (?, ?)`;

export async function createSession(input: { database: D1Database; accountId: string; now: number }): Promise<string | null> {
  const token = encodeBase64Url({ bytes: crypto.getRandomValues(new Uint8Array(CLIENT_APP_TOKEN_BYTES)) });
  const digest = await sha256Hex({ value: token });
  const { database, accountId, now } = input;
  const [, insert] = await database.batch([
    database.prepare(DELETE_ACCOUNT_SESSIONS_STATEMENT).bind(accountId),
    database
      .prepare(INSERT_SESSION_STATEMENT)
      .bind(digest, accountId, now, now + SESSION_TTL_MS, accountId, AccountState.Waitlisted, AccountState.Active),
  ]);
  return insert?.meta.changes === INSERTED_ROW ? token : null;
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

export async function deleteAccountSessions(input: { database: D1Database; accountId: string }): Promise<void> {
  await input.database.prepare(DELETE_ACCOUNT_SESSIONS_STATEMENT).bind(input.accountId).run();
}
