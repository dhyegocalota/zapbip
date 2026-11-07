import { describe, expect, it } from 'vitest';
import { createConnectionSecrets } from '../../src/adapters/platform/connection-secrets';
import { hashConnectionSecret } from '../../src/adapters/platform/hash';
import { CONNECTION_SECRET_PATTERN, CONNECTION_SECRET_PREFIX } from '../../src/contract/constants';

const ISSUED_SECRET_COUNT = 1_000;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const FORBIDDEN_BASE64_CHARACTERS = /[+/=]/;

describe('connection secrets', () => {
  it('issues a secret that matches the pattern', async () => {
    const { secret } = await createConnectionSecrets().issue();
    expect(secret).toMatch(CONNECTION_SECRET_PATTERN);
  });

  it('[row 442] issues distinct secrets in the base64url alphabet', async () => {
    const issued = await Promise.all(Array.from({ length: ISSUED_SECRET_COUNT }, () => createConnectionSecrets().issue()));
    expect(new Set(issued.map(({ secret }) => secret)).size).toBe(ISSUED_SECRET_COUNT);
    expect(issued.every(({ secret }) => CONNECTION_SECRET_PATTERN.test(secret))).toBe(true);
    expect(issued.some(({ secret }) => FORBIDDEN_BASE64_CHARACTERS.test(secret))).toBe(false);
  });

  it('issues the digest of the secret', async () => {
    const { secret, digest } = await createConnectionSecrets().issue();
    expect(digest).toMatch(DIGEST_PATTERN);
    expect(digest).toBe(await hashConnectionSecret({ secret }));
  });

  it('pin digests the prefix as part of the secret', async () => {
    const { secret } = await createConnectionSecrets().issue();
    const withoutPrefix = secret.slice(CONNECTION_SECRET_PREFIX.length);
    expect(await hashConnectionSecret({ secret })).not.toBe(await hashConnectionSecret({ secret: withoutPrefix }));
  });
});
