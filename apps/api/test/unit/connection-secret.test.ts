import { describe, expect, it } from 'vitest';
import { generateConnectionSecret } from '../../src/adapters/platform/connection-secret';
import { hashConnectionSecret } from '../../src/adapters/platform/hash';
import { CONNECTION_SECRET_PATTERN } from '../../src/contract/constants';

const GENERATED_SECRET_COUNT = 1_000;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const FIXED_SECRET = `zb_conn_${'A'.repeat(43)}`;
const FIXED_SECRET_DIGEST = '3b7d80fc9a4468769bc3a4505f06222a777b80a0732c9dcd3e03df05e876e37c';

describe('connection secret', () => {
  it('matches the secret pattern', () => {
    expect(generateConnectionSecret()).toMatch(CONNECTION_SECRET_PATTERN);
  });

  it('generates distinct secrets', () => {
    const secrets = Array.from({ length: GENERATED_SECRET_COUNT }, () => generateConnectionSecret());
    expect(new Set(secrets).size).toBe(GENERATED_SECRET_COUNT);
  });

  it('digests to 64 lowercase hex characters', async () => {
    expect(await hashConnectionSecret({ secret: generateConnectionSecret() })).toMatch(DIGEST_PATTERN);
  });

  it('digests the fixed vector', async () => {
    expect(await hashConnectionSecret({ secret: FIXED_SECRET })).toBe(FIXED_SECRET_DIGEST);
  });

  it('digests the same secret to the same value', async () => {
    const first = await hashConnectionSecret({ secret: FIXED_SECRET });
    const second = await hashConnectionSecret({ secret: FIXED_SECRET });
    expect(first).toBe(second);
  });

  it('digests different secrets to different values', async () => {
    const first = await hashConnectionSecret({ secret: FIXED_SECRET });
    const second = await hashConnectionSecret({ secret: generateConnectionSecret() });
    expect(first).not.toBe(second);
  });
});
