import { BEARER_PREFIX } from '../../mcp/constants';
import { constantTimeEqual } from '../auth/constant-time';
import { hashOperatorKey, isOperatorKeyLive, parseOperatorKey } from './operator-key';
import { findOperatorKey } from './operator-key-store';

export function bearerKeyOf(input: { authorization: string | undefined }): string | null {
  const { authorization } = input;
  if (authorization === undefined || !authorization.startsWith(BEARER_PREFIX)) return null;
  return authorization.slice(BEARER_PREFIX.length);
}

// NB ADR 0046: the key id selects the row and the digest is compared in constant time.
export async function authenticateOperatorKey(input: { database: D1Database; key: string | null; now: number }): Promise<string | null> {
  const { database, key, now } = input;
  if (key === null) return null;
  const parsed = parseOperatorKey({ key });
  if (parsed === null) return null;
  const [record, digest] = await Promise.all([findOperatorKey({ database, keyId: parsed.keyId }), hashOperatorKey({ key })]);
  if (record === null) return null;
  const isDigestMatch = constantTimeEqual({ left: record.keyDigest, right: digest });
  const isLive = isOperatorKeyLive({ expiresAt: record.expiresAt, revokedAt: record.revokedAt, now });
  return isDigestMatch && isLive ? record.id : null;
}
