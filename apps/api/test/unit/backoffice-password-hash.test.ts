import { createHmac, pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/backoffice/auth/password-hash';
import { isPasswordLengthAllowed, normalizePassword } from '../../src/backoffice/auth/password-policy';
import {
  PASSWORD_HASH_ITERATIONS,
  PASSWORD_HASH_MAX_ITERATIONS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../../src/contract/constants';

const PASSWORD = 'correct horse 1';
const PEPPER = 'pepper-a';
const OTHER_PEPPER = 'pepper-b';
const STORED_FORMAT = new RegExp(`^pbkdf2-sha256\\$${PASSWORD_HASH_ITERATIONS}\\$[A-Za-z0-9_-]{22}\\$[A-Za-z0-9_-]{43}$`);
const OTHER_ITERATIONS = PASSWORD_HASH_ITERATIONS + 10_000;
const OTHER_SALT = Buffer.alloc(16, 7);
const DERIVED_BYTES = 32;
const CPU_BUDGET_MICROSECONDS = 50_000;

async function cpuMicrosecondsOf(input: { run: () => Promise<unknown> }): Promise<number> {
  const before = process.cpuUsage();
  await input.run();
  const used = process.cpuUsage(before);
  return used.user + used.system;
}

function storedHashOf(input: { password: string; pepper: string; iterations: number }): string {
  const digest = createHmac('sha256', input.pepper).update(input.password.normalize('NFKC')).digest();
  const derived = pbkdf2Sync(digest, OTHER_SALT, input.iterations, DERIVED_BYTES, 'sha256');
  return `pbkdf2-sha256$${input.iterations}$${OTHER_SALT.toString('base64url')}$${derived.toString('base64url')}`;
}

describe('hashPassword', () => {
  it('stores the algorithm, iterations, salt and hash', async () => {
    expect(await hashPassword({ password: PASSWORD, pepper: PEPPER })).toMatch(STORED_FORMAT);
  });

  it('salts every hash', async () => {
    const first = await hashPassword({ password: PASSWORD, pepper: PEPPER });
    const second = await hashPassword({ password: PASSWORD, pepper: PEPPER });
    expect(first).not.toBe(second);
  });

  it('stays under the Workers Free plan CPU budget', async () => {
    const hashMicroseconds = await cpuMicrosecondsOf({ run: () => hashPassword({ password: PASSWORD, pepper: PEPPER }) });
    expect(hashMicroseconds).toBeLessThan(CPU_BUDGET_MICROSECONDS);
  });
});

describe('verifyPassword', () => {
  it('accepts the right password', async () => {
    const storedHash = await hashPassword({ password: PASSWORD, pepper: PEPPER });
    expect(await verifyPassword({ password: PASSWORD, pepper: PEPPER, storedHash })).toBe(true);
  });

  it('refuses a wrong password and a case change', async () => {
    const storedHash = await hashPassword({ password: PASSWORD, pepper: PEPPER });
    expect(await verifyPassword({ password: 'correct horse 2', pepper: PEPPER, storedHash })).toBe(false);
    expect(await verifyPassword({ password: PASSWORD.toUpperCase(), pepper: PEPPER, storedHash })).toBe(false);
  });

  it('refuses the right password under another pepper', async () => {
    const storedHash = await hashPassword({ password: PASSWORD, pepper: PEPPER });
    expect(await verifyPassword({ password: PASSWORD, pepper: OTHER_PEPPER, storedHash })).toBe(false);
  });

  it('verifies a stored string with its own iteration count', async () => {
    const storedHash = storedHashOf({ password: PASSWORD, pepper: PEPPER, iterations: OTHER_ITERATIONS });
    expect(await verifyPassword({ password: PASSWORD, pepper: PEPPER, storedHash })).toBe(true);
  });

  it.each([PASSWORD_HASH_ITERATIONS - 1, PASSWORD_HASH_MAX_ITERATIONS + 1])(
    'refuses a stored string claiming %i iterations without deriving anything',
    async (iterations) => {
      const storedHash = storedHashOf({ password: PASSWORD, pepper: PEPPER, iterations: Math.min(iterations, OTHER_ITERATIONS) }).replace(
        /^pbkdf2-sha256\$\d+/,
        `pbkdf2-sha256$${iterations}`,
      );
      await expect(verifyPassword({ password: PASSWORD, pepper: PEPPER, storedHash })).rejects.toThrow();
    },
  );

  it('accepts a stored string at the platform cap', async () => {
    const storedHash = storedHashOf({ password: PASSWORD, pepper: PEPPER, iterations: PASSWORD_HASH_MAX_ITERATIONS });
    expect(await verifyPassword({ password: PASSWORD, pepper: PEPPER, storedHash })).toBe(true);
  });

  it('accepts a composed and a decomposed spelling of one password', async () => {
    const storedHash = await hashPassword({ password: 'café café café', pepper: PEPPER });
    expect(await verifyPassword({ password: 'café café café', pepper: PEPPER, storedHash })).toBe(true);
  });

  it('throws on a malformed stored string', async () => {
    await expect(verifyPassword({ password: PASSWORD, pepper: PEPPER, storedHash: 'not-a-hash' })).rejects.toThrow();
    await expect(verifyPassword({ password: PASSWORD, pepper: PEPPER, storedHash: 'md5$1$a$b' })).rejects.toThrow();
  });

  it('stays under the Workers Free plan CPU budget', async () => {
    const storedHash = await hashPassword({ password: PASSWORD, pepper: PEPPER });
    const verifyMicroseconds = await cpuMicrosecondsOf({ run: () => verifyPassword({ password: PASSWORD, pepper: PEPPER, storedHash }) });
    expect(verifyMicroseconds).toBeLessThan(CPU_BUDGET_MICROSECONDS);
  });
});

describe('normalizePassword', () => {
  it('maps a ligature to its letters', () => {
    expect(normalizePassword({ value: 'ﬁ' })).toBe('fi');
  });

  it('composes a decomposed letter', () => {
    expect(normalizePassword({ value: 'é' })).toBe('é');
  });

  it('keeps surrounding whitespace', () => {
    expect(normalizePassword({ value: ' a ' })).toBe(' a ');
  });
});

describe('isPasswordLengthAllowed', () => {
  it('accepts the bounds', () => {
    expect(isPasswordLengthAllowed({ password: 'a'.repeat(PASSWORD_MIN_LENGTH) })).toBe(true);
    expect(isPasswordLengthAllowed({ password: 'a'.repeat(PASSWORD_MAX_LENGTH) })).toBe(true);
  });

  it('refuses one below and one above', () => {
    expect(isPasswordLengthAllowed({ password: 'a'.repeat(PASSWORD_MIN_LENGTH - 1) })).toBe(false);
    expect(isPasswordLengthAllowed({ password: 'a'.repeat(PASSWORD_MAX_LENGTH + 1) })).toBe(false);
  });

  it('measures the normalised value', () => {
    expect(isPasswordLengthAllowed({ password: 'ﬁ'.repeat(PASSWORD_MIN_LENGTH / 2) })).toBe(true);
  });

  it('counts code points, not code units', () => {
    expect(isPasswordLengthAllowed({ password: '\u{1F600}'.repeat(PASSWORD_MIN_LENGTH) })).toBe(true);
  });
});
