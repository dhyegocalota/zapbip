export type OperatorKeyRecord = {
  id: string;
  label: string;
  keyDigest: string;
  createdAt: number;
  expiresAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
};

const INSERT_KEY_STATEMENT = 'INSERT INTO backoffice_agent_keys (id, label, key_digest, created_at, expires_at) VALUES (?, ?, ?, ?, ?)';
const SELECT_COLUMNS =
  'SELECT id, label, key_digest AS keyDigest, created_at AS createdAt, expires_at AS expiresAt, last_used_at AS lastUsedAt, revoked_at AS revokedAt FROM backoffice_agent_keys';
const FIND_KEY_STATEMENT = SELECT_COLUMNS + ' WHERE id = ?';
const LIST_KEYS_STATEMENT = SELECT_COLUMNS + ' ORDER BY created_at DESC, rowid DESC LIMIT ?';
const REVOKE_KEY_STATEMENT = 'UPDATE backoffice_agent_keys SET revoked_at = ?1 WHERE id = ?2 AND revoked_at IS NULL';
const STAMP_LAST_USED_STATEMENT =
  'UPDATE backoffice_agent_keys SET last_used_at = ?1 WHERE id = ?2 AND (last_used_at IS NULL OR last_used_at <= ?1 - ?3)';

export async function insertOperatorKey(input: {
  database: D1Database;
  keyId: string;
  label: string;
  keyDigest: string;
  createdAt: number;
  expiresAt: number;
}): Promise<void> {
  const { database, keyId, label, keyDigest, createdAt, expiresAt } = input;
  await database.prepare(INSERT_KEY_STATEMENT).bind(keyId, label, keyDigest, createdAt, expiresAt).run();
}

export function findOperatorKey(input: { database: D1Database; keyId: string }): Promise<OperatorKeyRecord | null> {
  return input.database.prepare(FIND_KEY_STATEMENT).bind(input.keyId).first<OperatorKeyRecord>();
}

export async function listOperatorKeys(input: { database: D1Database; limit: number }): Promise<OperatorKeyRecord[]> {
  const { results } = await input.database.prepare(LIST_KEYS_STATEMENT).bind(input.limit).all<OperatorKeyRecord>();
  return results;
}

export async function revokeOperatorKey(input: { database: D1Database; keyId: string; now: number }): Promise<boolean> {
  const result = await input.database.prepare(REVOKE_KEY_STATEMENT).bind(input.now, input.keyId).run();
  return result.meta.changes > 0;
}

export async function stampOperatorKeyUse(input: { database: D1Database; keyId: string; now: number; interval: number }): Promise<void> {
  await input.database.prepare(STAMP_LAST_USED_STATEMENT).bind(input.now, input.keyId, input.interval).run();
}
