import { encodeBase64Url, encodeHex } from '../../adapters/platform/encoding';
import { sha256Hex } from '../../adapters/platform/hash';
import { OPERATOR_KEY_MAX_LIFETIME_DAYS, OPERATOR_KEY_PATTERN, OPERATOR_KEY_PREFIX } from './operator-mcp-constants';

export type OperatorKeyMaterial = { keyId: string; key: string };

const WHOLE_NUMBER_PATTERN = /^\d+$/;
const KEY_PART_SEPARATOR = '_';

export function createOperatorKey(input: { idBytes: Uint8Array; secretBytes: Uint8Array }): OperatorKeyMaterial {
  const keyId = encodeHex({ bytes: input.idBytes });
  const secret = encodeBase64Url({ bytes: input.secretBytes });
  return { keyId, key: `${OPERATOR_KEY_PREFIX}${keyId}${KEY_PART_SEPARATOR}${secret}` };
}

export function parseOperatorKey(input: { key: string }): { keyId: string } | null {
  const match = OPERATOR_KEY_PATTERN.exec(input.key);
  if (match === null) return null;
  return { keyId: match[1]! };
}

export function hashOperatorKey(input: { key: string }): Promise<string> {
  return sha256Hex({ value: input.key });
}

export function isOperatorKeyLive(input: { expiresAt: number; revokedAt: number | null; now: number }): boolean {
  return input.revokedAt === null && input.expiresAt > input.now;
}

export function parseKeyLifetimeDays(input: { value: string }): number | null {
  if (!WHOLE_NUMBER_PATTERN.test(input.value)) return null;
  const days = Number(input.value);
  return days >= 1 && days <= OPERATOR_KEY_MAX_LIFETIME_DAYS ? days : null;
}
