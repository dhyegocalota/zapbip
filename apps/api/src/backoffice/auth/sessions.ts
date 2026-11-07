import { MINUTE_MS } from '@zapbip/types';
import { encodeBase64Url } from '../../adapters/platform/encoding';
import { sha256Hex } from '../../adapters/platform/hash';
import { BACKOFFICE_SESSION_IDLE_MS, BACKOFFICE_SESSION_MAX_MS } from '../../contract/constants';
import { SESSION_TOKEN_BYTES } from '../backoffice-constants';
import type { BackofficeSession } from '../backoffice-env';

type SessionRow = { last_seen_at: number };

const SESSION_TOUCH_INTERVAL_MS = MINUTE_MS;
const INSERT_SESSION_STATEMENT = 'INSERT INTO backoffice_sessions (token_digest, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?)';
const FIND_SESSION_STATEMENT = 'SELECT last_seen_at FROM backoffice_sessions WHERE token_digest = ? AND expires_at > ?';
const TOUCH_SESSION_STATEMENT = 'UPDATE backoffice_sessions SET last_seen_at = ? WHERE token_digest = ?';
const DELETE_SESSION_STATEMENT = 'DELETE FROM backoffice_sessions WHERE token_digest = ?';

export async function createSession(input: { database: D1Database; now: number }): Promise<string> {
  const token = encodeBase64Url({ bytes: crypto.getRandomValues(new Uint8Array(SESSION_TOKEN_BYTES)) });
  const digest = await sha256Hex({ value: token });
  const { now } = input;
  await input.database
    .prepare(INSERT_SESSION_STATEMENT)
    .bind(digest, now, now, now + BACKOFFICE_SESSION_MAX_MS)
    .run();
  return token;
}

export async function findSession(input: { database: D1Database; token: string; now: number }): Promise<BackofficeSession | null> {
  const { database, token, now } = input;
  const digest = await sha256Hex({ value: token });
  const row = await database.prepare(FIND_SESSION_STATEMENT).bind(digest, now).first<SessionRow>();
  if (row === null) return null;
  const idleMs = now - row.last_seen_at;
  if (idleMs > BACKOFFICE_SESSION_IDLE_MS) return null;
  if (idleMs >= SESSION_TOUCH_INTERVAL_MS) await database.prepare(TOUCH_SESSION_STATEMENT).bind(now, digest).run();
  return { token, digest };
}

export async function deleteSession(input: { database: D1Database; digest: string }): Promise<void> {
  await input.database.prepare(DELETE_SESSION_STATEMENT).bind(input.digest).run();
}
