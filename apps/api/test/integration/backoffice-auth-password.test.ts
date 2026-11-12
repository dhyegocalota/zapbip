import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { verifyPassword } from '../../src/backoffice/auth/password-hash';
import { attemptCodeSignIn, attemptPasswordSignIn, PasswordSignInOutcome, SignInOutcome } from '../../src/backoffice/auth/sign-in';
import { createPendingSignIn } from '../../src/backoffice/auth/pending-sign-in';
import {
  BACKOFFICE_LOCKOUT_MS,
  BACKOFFICE_LOCKOUT_THRESHOLD,
  BACKOFFICE_PENDING_SIGN_IN_MS,
  PASSWORD_SUBMIT_MAX_LENGTH,
} from '../../src/contract/constants';
import { testEnv } from '../support/workers-env';
import {
  BACKOFFICE_TEST_EMAIL,
  BACKOFFICE_TEST_PASSWORD,
  CLIENT_ADDRESS,
  readOperator,
  resetBackoffice,
  validCode,
  WRONG_CODE,
} from './backoffice-auth-fixtures';

vi.mock('../../src/backoffice/auth/password-hash', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../src/backoffice/auth/password-hash')>();
  return { ...original, verifyPassword: vi.fn(original.verifyPassword) };
});

const NOW = Date.UTC(2026, 10, 7, 12);
const WRONG_PASSWORD = 'not the operator password';
const UNKNOWN_EMAIL = 'stranger@zapbip.test';
const FAILED_ACTION = 'sign_in.failed';
const LOCKED_ACTION = 'sign_in.locked';
const SUCCEEDED_ACTION = 'sign_in.succeeded';
const database = testEnv.CONNECTIONS;

async function auditRows(input: { action: string }): Promise<number> {
  const row = await database
    .prepare('SELECT COUNT(*) AS total FROM backoffice_audit WHERE action = ?')
    .bind(input.action)
    .first<{ total: number }>();
  return row!.total;
}

async function countOf(input: { table: string }): Promise<number> {
  const row = await database.prepare(`SELECT COUNT(*) AS total FROM ${input.table}`).first<{ total: number }>();
  return row!.total;
}

function signInWith(input: { email: string; password: string; now?: number }) {
  const { email, password, now = NOW } = input;
  return attemptPasswordSignIn({ env: testEnv, email, password, now, clientAddress: CLIENT_ADDRESS });
}

function submitCode(input: { pendingToken: string; code: string; now?: number }) {
  const { pendingToken, code, now = NOW } = input;
  return attemptCodeSignIn({ env: testEnv, pendingToken, code, now, clientAddress: CLIENT_ADDRESS });
}

beforeEach(async () => {
  await resetBackoffice();
  vi.mocked(verifyPassword).mockClear();
});

afterEach(() => {
  vi.mocked(verifyPassword).mockClear();
});

describe('password step', () => {
  test('a right pair creates one pending row and returns its token', async () => {
    const result = await signInWith({ email: BACKOFFICE_TEST_EMAIL, password: BACKOFFICE_TEST_PASSWORD });
    expect(result.outcome).toBe(PasswordSignInOutcome.Accepted);
    expect(await countOf({ table: 'backoffice_pending_sign_ins' })).toBe(1);
  });

  test('the email is trimmed and compared in lower case', async () => {
    const result = await signInWith({ email: `  ${BACKOFFICE_TEST_EMAIL.toUpperCase()} `, password: BACKOFFICE_TEST_PASSWORD });
    expect(result.outcome).toBe(PasswordSignInOutcome.Accepted);
  });

  test.each([
    ['a wrong password', BACKOFFICE_TEST_EMAIL, WRONG_PASSWORD],
    ['an unknown email', UNKNOWN_EMAIL, BACKOFFICE_TEST_PASSWORD],
    ['an email in another case with a wrong password', BACKOFFICE_TEST_EMAIL.toUpperCase(), WRONG_PASSWORD],
  ])('%s fails after one hash, counts once and audits once', async (_name, email, password) => {
    const result = await signInWith({ email, password });
    expect(result.outcome).toBe(PasswordSignInOutcome.Failed);
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(await readOperator()).toMatchObject({ password_failed_attempts: 1, failed_attempts: 0 });
    expect(await auditRows({ action: FAILED_ACTION })).toBe(1);
    expect(await countOf({ table: 'backoffice_pending_sign_ins' })).toBe(0);
  });

  test('a password longer than the submit cap fails without a hash, counts once and audits once', async () => {
    const result = await signInWith({ email: BACKOFFICE_TEST_EMAIL, password: 'a'.repeat(PASSWORD_SUBMIT_MAX_LENGTH + 1) });
    expect(result.outcome).toBe(PasswordSignInOutcome.Failed);
    expect(verifyPassword).not.toHaveBeenCalled();
    expect(await readOperator()).toMatchObject({ password_failed_attempts: 1, failed_attempts: 0 });
    expect(await auditRows({ action: FAILED_ACTION })).toBe(1);
  });

  test('a password-locked operator fails after one hash and adds nothing', async () => {
    await database
      .prepare('UPDATE backoffice_operator SET password_failed_attempts = ?, password_locked_until = ? WHERE id = 1')
      .bind(BACKOFFICE_LOCKOUT_THRESHOLD, NOW + BACKOFFICE_LOCKOUT_MS)
      .run();
    const result = await signInWith({ email: BACKOFFICE_TEST_EMAIL, password: BACKOFFICE_TEST_PASSWORD });
    expect(result.outcome).toBe(PasswordSignInOutcome.Failed);
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect((await readOperator()).password_failed_attempts).toBe(BACKOFFICE_LOCKOUT_THRESHOLD);
    expect(await auditRows({ action: FAILED_ACTION })).toBe(0);
    expect(await countOf({ table: 'backoffice_pending_sign_ins' })).toBe(0);
  });

  test('a code-locked operator also fails the password step after one hash and adds nothing', async () => {
    await database
      .prepare('UPDATE backoffice_operator SET failed_attempts = ?, locked_until = ? WHERE id = 1')
      .bind(BACKOFFICE_LOCKOUT_THRESHOLD, NOW + BACKOFFICE_LOCKOUT_MS)
      .run();
    const result = await signInWith({ email: BACKOFFICE_TEST_EMAIL, password: BACKOFFICE_TEST_PASSWORD });
    expect(result.outcome).toBe(PasswordSignInOutcome.Failed);
    expect(verifyPassword).toHaveBeenCalledTimes(1);
    expect(await readOperator()).toMatchObject({ password_failed_attempts: 0, failed_attempts: BACKOFFICE_LOCKOUT_THRESHOLD });
    expect(await auditRows({ action: FAILED_ACTION })).toBe(0);
  });

  test('the tenth consecutive failure locks the password step and audits the lock', async () => {
    for (let attempt = 0; attempt < BACKOFFICE_LOCKOUT_THRESHOLD; attempt += 1) {
      await signInWith({ email: BACKOFFICE_TEST_EMAIL, password: WRONG_PASSWORD });
    }
    expect(await readOperator()).toMatchObject({
      password_failed_attempts: BACKOFFICE_LOCKOUT_THRESHOLD,
      password_locked_until: NOW + BACKOFFICE_LOCKOUT_MS,
      failed_attempts: 0,
      locked_until: null,
    });
    expect(await auditRows({ action: LOCKED_ACTION })).toBe(1);
  });

  test('an operator with no enrolled password fails every attempt after one hash', async () => {
    await database.prepare('UPDATE backoffice_operator SET email = NULL, password_hash = NULL WHERE id = 1').run();
    const result = await signInWith({ email: BACKOFFICE_TEST_EMAIL, password: BACKOFFICE_TEST_PASSWORD });
    expect(result.outcome).toBe(PasswordSignInOutcome.Failed);
    expect(verifyPassword).toHaveBeenCalledTimes(1);
  });
});

describe('code step', () => {
  test('a right code against a live pending state opens a session and audits it', async () => {
    const pendingToken = await createPendingSignIn({ database, now: NOW });
    const result = await submitCode({ pendingToken, code: await validCode({ now: NOW }) });
    expect(result.outcome).toBe(SignInOutcome.Succeeded);
    expect(await countOf({ table: 'backoffice_sessions' })).toBe(1);
    expect(await auditRows({ action: SUCCEEDED_ACTION })).toBe(1);
    expect(await countOf({ table: 'backoffice_pending_sign_ins' })).toBe(0);
  });

  test('a wrong code uses up the pending state and counts one failure', async () => {
    const pendingToken = await createPendingSignIn({ database, now: NOW });
    const result = await submitCode({ pendingToken, code: WRONG_CODE });
    expect(result.outcome).toBe(SignInOutcome.Failed);
    expect((await readOperator()).failed_attempts).toBe(1);
    expect(await auditRows({ action: FAILED_ACTION })).toBe(1);
    expect(await countOf({ table: 'backoffice_pending_sign_ins' })).toBe(0);
  });

  test('a code whose step was already used counts one failure', async () => {
    const code = await validCode({ now: NOW });
    await submitCode({ pendingToken: await createPendingSignIn({ database, now: NOW }), code });
    const replay = await submitCode({ pendingToken: await createPendingSignIn({ database, now: NOW }), code });
    expect(replay.outcome).toBe(SignInOutcome.Failed);
    expect((await readOperator()).failed_attempts).toBe(1);
    expect(await countOf({ table: 'backoffice_sessions' })).toBe(1);
  });

  test('an unknown pending token fails and adds nothing', async () => {
    const result = await submitCode({ pendingToken: 'unknown-token', code: await validCode({ now: NOW }) });
    expect(result.outcome).toBe(SignInOutcome.Failed);
    expect((await readOperator()).failed_attempts).toBe(0);
    expect(await auditRows({ action: FAILED_ACTION })).toBe(0);
  });

  test('an expired pending token fails and adds nothing', async () => {
    const pendingToken = await createPendingSignIn({ database, now: NOW });
    const result = await submitCode({ pendingToken, code: await validCode({ now: NOW }), now: NOW + BACKOFFICE_PENDING_SIGN_IN_MS });
    expect(result.outcome).toBe(SignInOutcome.Failed);
    expect((await readOperator()).failed_attempts).toBe(0);
    expect(await auditRows({ action: FAILED_ACTION })).toBe(0);
  });

  test('a locked operator fails with a right code, adds nothing and leaves the step unused', async () => {
    await database
      .prepare('UPDATE backoffice_operator SET failed_attempts = ?, locked_until = ? WHERE id = 1')
      .bind(BACKOFFICE_LOCKOUT_THRESHOLD, NOW + BACKOFFICE_LOCKOUT_MS)
      .run();
    const pendingToken = await createPendingSignIn({ database, now: NOW });
    const result = await submitCode({ pendingToken, code: await validCode({ now: NOW }) });
    expect(result.outcome).toBe(SignInOutcome.Failed);
    expect(await readOperator()).toMatchObject({ failed_attempts: BACKOFFICE_LOCKOUT_THRESHOLD, last_totp_step: 0 });
    expect(await countOf({ table: 'backoffice_sessions' })).toBe(0);
  });
});
