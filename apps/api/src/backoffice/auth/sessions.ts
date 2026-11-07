import { encodeBase64Url } from '../../adapters/platform/encoding';
import { sha256Hex } from '../../adapters/platform/hash';
import { BACKOFFICE_SESSION_MAX_MS } from '../../contract/constants';
import { SESSION_TOKEN_BYTES } from '../backoffice-constants';
import type { BackofficeSession } from '../backoffice-env';

const INSERT_SESSION_STATEMENT = 'INSERT INTO backoffice_sessions (token_digest, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?)';
const FIND_SESSION_STATEMENT = 'SELECT token_digest FROM backoffice_sessions WHERE token_digest = ? AND expires_at > ?';

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
  const digest = await sha256Hex({ value: input.token });
  const row = await input.database.prepare(FIND_SESSION_STATEMENT).bind(digest, input.now).first<{ token_digest: string }>();
  if (row === null) return null;
  return { token: input.token, digest };
}
