import { sha256Hex } from '../adapters/platform/hash';

const FIND_TOKEN_STATEMENT = 'SELECT 1 AS found FROM client_app_sign_in_tokens WHERE token_digest = ? AND expires_at > ?';
const CONSUME_TOKEN_STATEMENT =
  'DELETE FROM client_app_sign_in_tokens WHERE token_digest = ? AND expires_at > ? RETURNING account_id AS accountId';

export async function isSignInTokenOpen(input: { database: D1Database; token: string; now: number }): Promise<boolean> {
  const digest = await sha256Hex({ value: input.token });
  const row = await input.database.prepare(FIND_TOKEN_STATEMENT).bind(digest, input.now).first();
  return row !== null;
}

export async function consumeSignInToken(input: { database: D1Database; token: string; now: number }): Promise<string | null> {
  const digest = await sha256Hex({ value: input.token });
  const row = await input.database.prepare(CONSUME_TOKEN_STATEMENT).bind(digest, input.now).first<{ accountId: string }>();
  if (row === null) return null;
  return row.accountId;
}
