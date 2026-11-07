import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { csrfTokenOf, isSessionCsrfTokenValid } from '../../src/backoffice/auth/csrf';
import { isBackofficeKey } from '../../src/backoffice/auth/sign-in';

const KEY = `zb_bo_${'K'.repeat(43)}`;
const KEY_DIGEST = createHash('sha256').update(KEY).digest('hex');
const SESSION_TOKEN = 'session-token-a';
const OTHER_SESSION_TOKEN = 'session-token-b';
const DIGEST_BYTES = 32;

describe('backoffice key compare', () => {
  it('accepts the right key', async () => {
    expect(await isBackofficeKey({ submittedKey: KEY, expectedDigest: KEY_DIGEST })).toBe(true);
  });

  it('refuses the right key plus one character', async () => {
    expect(await isBackofficeKey({ submittedKey: `${KEY}x`, expectedDigest: KEY_DIGEST })).toBe(false);
  });

  it('refuses an empty key', async () => {
    expect(await isBackofficeKey({ submittedKey: '', expectedDigest: KEY_DIGEST })).toBe(false);
  });

  it('compares digests of equal length', () => {
    expect(Buffer.from(KEY_DIGEST, 'hex')).toHaveLength(DIGEST_BYTES);
    expect(Buffer.from(createHash('sha256').update('').digest('hex'), 'hex')).toHaveLength(DIGEST_BYTES);
  });
});

describe('csrf token', () => {
  it('is stable for one session', async () => {
    expect(await csrfTokenOf({ sessionToken: SESSION_TOKEN })).toBe(await csrfTokenOf({ sessionToken: SESSION_TOKEN }));
  });

  it('differs between sessions', async () => {
    expect(await csrfTokenOf({ sessionToken: SESSION_TOKEN })).not.toBe(await csrfTokenOf({ sessionToken: OTHER_SESSION_TOKEN }));
  });

  it('is refused by another session', async () => {
    const submittedToken = await csrfTokenOf({ sessionToken: SESSION_TOKEN });
    expect(await isSessionCsrfTokenValid({ sessionToken: SESSION_TOKEN, submittedToken })).toBe(true);
    expect(await isSessionCsrfTokenValid({ sessionToken: OTHER_SESSION_TOKEN, submittedToken })).toBe(false);
  });
});
