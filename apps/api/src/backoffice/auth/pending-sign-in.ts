import { encodeBase64Url } from '../../adapters/platform/encoding';
import { sha256Hex } from '../../adapters/platform/hash';
import { BACKOFFICE_PENDING_SIGN_IN_MS } from '../../contract/constants';
import { SESSION_TOKEN_BYTES } from '../backoffice-constants';

const DELETE_ALL_STATEMENT = 'DELETE FROM backoffice_pending_sign_ins';
const INSERT_STATEMENT = 'INSERT INTO backoffice_pending_sign_ins (token_digest, created_at, expires_at) VALUES (?, ?, ?)';
const CONSUME_STATEMENT = 'DELETE FROM backoffice_pending_sign_ins WHERE token_digest = ? RETURNING expires_at';
const FIND_LIVE_STATEMENT = 'SELECT expires_at FROM backoffice_pending_sign_ins WHERE token_digest = ? AND expires_at > ?';

export async function createPendingSignIn(input: { database: D1Database; now: number }): Promise<string> {
  const { database, now } = input;
  const token = encodeBase64Url({ bytes: crypto.getRandomValues(new Uint8Array(SESSION_TOKEN_BYTES)) });
  const digest = await sha256Hex({ value: token });
  await database.batch([
    database.prepare(DELETE_ALL_STATEMENT),
    database.prepare(INSERT_STATEMENT).bind(digest, now, now + BACKOFFICE_PENDING_SIGN_IN_MS),
  ]);
  return token;
}

export async function consumePendingSignIn(input: { database: D1Database; token: string; now: number }): Promise<boolean> {
  const digest = await sha256Hex({ value: input.token });
  const row = await input.database.prepare(CONSUME_STATEMENT).bind(digest).first<{ expires_at: number }>();
  return row !== null && row.expires_at > input.now;
}

export async function isPendingSignInLive(input: { database: D1Database; token: string; now: number }): Promise<boolean> {
  const digest = await sha256Hex({ value: input.token });
  const row = await input.database.prepare(FIND_LIVE_STATEMENT).bind(digest, input.now).first();
  return row !== null;
}
