import { sha256Hex } from '../adapters/platform/hash';

const FIND_TOKEN_OWNER_STATEMENT = `SELECT owner_identities.wa_id AS waId
  FROM client_app_sign_in_tokens
  JOIN owner_identities ON owner_identities.account_id = client_app_sign_in_tokens.account_id
  WHERE client_app_sign_in_tokens.token_digest = ? AND client_app_sign_in_tokens.expires_at > ?`;
const CONSUME_TOKEN_STATEMENT =
  'DELETE FROM client_app_sign_in_tokens WHERE token_digest = ? AND expires_at > ? RETURNING account_id AS accountId';

export async function findSignInTokenOwner(input: { database: D1Database; token: string; now: number }): Promise<string | null> {
  const digest = await sha256Hex({ value: input.token });
  const row = await input.database.prepare(FIND_TOKEN_OWNER_STATEMENT).bind(digest, input.now).first<{ waId: string }>();
  if (row === null) return null;
  return row.waId;
}

export async function consumeSignInToken(input: { database: D1Database; token: string; now: number }): Promise<string | null> {
  const digest = await sha256Hex({ value: input.token });
  const row = await input.database.prepare(CONSUME_TOKEN_STATEMENT).bind(digest, input.now).first<{ accountId: string }>();
  if (row === null) return null;
  return row.accountId;
}
