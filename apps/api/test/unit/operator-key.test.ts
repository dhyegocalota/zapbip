import { DAY_MS } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import {
  createOperatorKey,
  hashOperatorKey,
  isOperatorKeyLive,
  parseKeyLifetimeDays,
  parseOperatorKey,
} from '../../src/backoffice/operator-mcp/operator-key';
import {
  OPERATOR_KEY_ID_BYTES,
  OPERATOR_KEY_MAX_LIFETIME_DAYS,
  OPERATOR_KEY_PATTERN,
  OPERATOR_KEY_PREFIX,
  OPERATOR_KEY_SECRET_BYTES,
} from '../../src/backoffice/operator-mcp/operator-mcp-constants';

const NOW = Date.UTC(2026, 10, 13);

function freshKey() {
  return createOperatorKey({
    idBytes: crypto.getRandomValues(new Uint8Array(OPERATOR_KEY_ID_BYTES)),
    secretBytes: crypto.getRandomValues(new Uint8Array(OPERATOR_KEY_SECRET_BYTES)),
  });
}

describe('createOperatorKey', () => {
  it('builds a recognisable key from the id and the secret', () => {
    const { key, keyId } = freshKey();
    expect(key.startsWith(OPERATOR_KEY_PREFIX)).toBe(true);
    expect(key).toMatch(OPERATOR_KEY_PATTERN);
    expect(key).toContain(keyId);
  });

  it('gives two keys different ids and secrets', () => {
    expect(freshKey().key).not.toBe(freshKey().key);
  });

  it('is deterministic for the same bytes', () => {
    const idBytes = new Uint8Array(OPERATOR_KEY_ID_BYTES).fill(1);
    const secretBytes = new Uint8Array(OPERATOR_KEY_SECRET_BYTES).fill(2);
    expect(createOperatorKey({ idBytes, secretBytes })).toEqual(createOperatorKey({ idBytes, secretBytes }));
  });
});

describe('parseOperatorKey', () => {
  it('returns the key id of a well formed key', () => {
    const { key, keyId } = freshKey();
    expect(parseOperatorKey({ key })).toEqual({ keyId });
  });

  it.each(['', 'zbo_', 'zb_conn_abc', 'zbo_short_secret', ' ', 'ZBO_0000000000000000_0000000000000000000000000000000000000000000'])(
    'refuses %j',
    (key) => {
      expect(parseOperatorKey({ key })).toBeNull();
    },
  );

  it('refuses a key with trailing text', () => {
    expect(parseOperatorKey({ key: `${freshKey().key}x` })).toBeNull();
  });
});

describe('hashOperatorKey', () => {
  it('is a stable sha-256 hex digest that never contains the key', async () => {
    const { key } = freshKey();
    const digest = await hashOperatorKey({ key });
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).toBe(await hashOperatorKey({ key }));
    expect(digest).not.toContain(key);
  });

  it('differs for different keys', async () => {
    expect(await hashOperatorKey({ key: freshKey().key })).not.toBe(await hashOperatorKey({ key: freshKey().key }));
  });
});

describe('isOperatorKeyLive', () => {
  it('accepts an unrevoked key before its expiry', () => {
    expect(isOperatorKeyLive({ expiresAt: NOW + DAY_MS, revokedAt: null, now: NOW })).toBe(true);
  });

  it('refuses a key at its expiry instant and after', () => {
    expect(isOperatorKeyLive({ expiresAt: NOW, revokedAt: null, now: NOW })).toBe(false);
    expect(isOperatorKeyLive({ expiresAt: NOW - 1, revokedAt: null, now: NOW })).toBe(false);
  });

  it('refuses a revoked key', () => {
    expect(isOperatorKeyLive({ expiresAt: NOW + DAY_MS, revokedAt: NOW - 1, now: NOW })).toBe(false);
  });
});

describe('parseKeyLifetimeDays', () => {
  it.each([
    ['1', 1],
    ['90', 90],
    [String(OPERATOR_KEY_MAX_LIFETIME_DAYS), OPERATOR_KEY_MAX_LIFETIME_DAYS],
  ])('reads %s days', (value, days) => {
    expect(parseKeyLifetimeDays({ value })).toBe(days);
  });

  it.each(['0', '-3', '1.5', 'abc', '', ' ', String(OPERATOR_KEY_MAX_LIFETIME_DAYS + 1), '1e2'])('refuses %j', (value) => {
    expect(parseKeyLifetimeDays({ value })).toBeNull();
  });
});
