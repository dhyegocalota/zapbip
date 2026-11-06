import { describe, expect, it } from 'vitest';
import { createConnectionSecrets } from '../../src/adapters/platform/connection-secrets';
import { createInstallCodeVault } from '../../src/adapters/platform/install-code-vault';
import { INSTALL_CODE_PATTERN, INSTALL_CODE_PREFIX } from '../../src/contract/constants';

const ISSUED_CODE_COUNT = 1_000;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const FORBIDDEN_BASE64_CHARACTERS = /[+/=]/;

async function sealedFixture() {
  const vault = createInstallCodeVault();
  const { installCode } = await vault.issue();
  const { secret } = await createConnectionSecrets().issue();
  const sealed = await vault.seal({ installCode, secret });
  return { vault, installCode, secret, sealed };
}

describe('install code vault', () => {
  it('issues a code that matches the pattern with a sha-256 hex digest that is not the code', async () => {
    const { installCode, digest } = await createInstallCodeVault().issue();
    expect(installCode).toMatch(INSTALL_CODE_PATTERN);
    expect(installCode.startsWith(INSTALL_CODE_PREFIX)).toBe(true);
    expect(digest).toMatch(DIGEST_PATTERN);
    expect(digest).not.toContain(installCode);
  });

  it('issues distinct codes in the base64url alphabet', async () => {
    const vault = createInstallCodeVault();
    const issued = await Promise.all(Array.from({ length: ISSUED_CODE_COUNT }, () => vault.issue()));
    expect(new Set(issued.map(({ installCode }) => installCode)).size).toBe(ISSUED_CODE_COUNT);
    expect(issued.some(({ installCode }) => FORBIDDEN_BASE64_CHARACTERS.test(installCode))).toBe(false);
  });

  it('opens what it sealed with the same code', async () => {
    const { vault, installCode, secret, sealed } = await sealedFixture();
    expect(await vault.open({ installCode, sealed })).toBe(secret);
  });

  it('never puts the secret in the sealed value', async () => {
    const { secret, sealed } = await sealedFixture();
    expect(sealed).not.toContain(secret);
  });

  it('refuses to open with a code that differs in one character', async () => {
    const { vault, installCode, sealed } = await sealedFixture();
    const lastIndex = installCode.length - 1;
    const replacement = installCode[lastIndex] === 'A' ? 'B' : 'A';
    const otherCode = `${installCode.slice(0, lastIndex)}${replacement}`;
    await expect(vault.open({ installCode: otherCode, sealed })).rejects.toThrow();
  });

  it('refuses to open a tampered sealed value', async () => {
    const { vault, installCode, sealed } = await sealedFixture();
    const lastIndex = sealed.length - 1;
    const replacement = sealed[lastIndex] === 'A' ? 'B' : 'A';
    await expect(vault.open({ installCode, sealed: `${sealed.slice(0, lastIndex)}${replacement}` })).rejects.toThrow();
  });

  it('seals the same secret under the same code to different values', async () => {
    const { vault, installCode, secret, sealed } = await sealedFixture();
    expect(await vault.seal({ installCode, secret })).not.toBe(sealed);
  });
});
