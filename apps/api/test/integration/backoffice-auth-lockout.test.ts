import { SECOND_MS } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BACKOFFICE_LOCKOUT_MS, BACKOFFICE_LOCKOUT_THRESHOLD, TOTP_PERIOD_MS } from '../../src/contract/constants';
import { BackofficeAuditTargetKind } from '../../src/backoffice/audit/backoffice-audit-action';
import { createPendingSignIn } from '../../src/backoffice/auth/pending-sign-in';
import { StepUpOutcome, verifyStepUp } from '../../src/backoffice/auth/step-up';
import { testEnv } from '../support/workers-env';
import {
  backofficeEnv,
  BACKOFFICE_TEST_EMAIL,
  CLIENT_ADDRESS,
  openSignInForm,
  postCodeStep,
  postPasswordStep,
  readOperator,
  resetBackoffice,
  SIGN_IN_FAILED_LOCATION,
  signInWithCode,
  validCode,
  WRONG_CODE,
  WRONG_PASSWORD,
} from './backoffice-auth-fixtures';

const STATUS_SEE_OTHER = 303;
const NOW = Date.UTC(2026, 10, 7, 12);
const LOCKED_ACTION = 'sign_in.locked';
const FIVE_FAILURES = 5;
const TWENTY_CODE_POSTS = 20;
const LAST_FAILURE_BEFORE_LOCK = 9;
const LOCKING_FAILURE = 10;

beforeEach(async () => {
  await resetBackoffice();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

async function failMany(input: { count: number }): Promise<void> {
  for (let attempt = 0; attempt < input.count; attempt += 1) {
    await postPasswordStep({ email: BACKOFFICE_TEST_EMAIL, password: WRONG_PASSWORD });
  }
}

async function failManyCodes(input: { count: number }): Promise<void> {
  for (let attempt = 0; attempt < input.count; attempt += 1) {
    await signInWithCode({ code: WRONG_CODE });
  }
}

async function postCodesWithoutPendingState(input: { count: number }): Promise<void> {
  const { csrf } = await openSignInForm({});
  for (let attempt = 0; attempt < input.count; attempt += 1) {
    await postCodeStep({ code: WRONG_CODE, pendingToken: null, csrf });
  }
}

async function openPendingFor(input: { now: number }): Promise<{ pendingToken: string; csrf: string }> {
  const { csrf } = await openSignInForm({});
  return { pendingToken: await createPendingSignIn({ database: testEnv.CONNECTIONS, now: input.now }), csrf };
}

async function lockedAuditRows(): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM backoffice_audit WHERE action = ?')
    .bind(LOCKED_ACTION)
    .first<{ total: number }>();
  return row!.total;
}

describe('lockout', () => {
  test('twenty code posts without a pending state never lock the owner out: they count nothing', async () => {
    await postCodesWithoutPendingState({ count: TWENTY_CODE_POSTS });
    expect(await readOperator()).toMatchObject({ failed_attempts: 0, locked_until: null });
    const response = await signInWithCode({ code: await validCode({}) });
    expect(response.headers.get('location')).toBe('/');
  });

  test('wrong passwords and an unknown email count on the password counter and wrong codes on the code counter', async () => {
    await signInWithCode({ code: WRONG_CODE });
    await failMany({ count: BACKOFFICE_LOCKOUT_THRESHOLD - 2 });
    await postPasswordStep({ email: 'stranger@zapbip.test', password: WRONG_PASSWORD });
    expect(await readOperator()).toMatchObject({
      password_failed_attempts: BACKOFFICE_LOCKOUT_THRESHOLD - 1,
      password_locked_until: null,
      failed_attempts: 1,
      locked_until: null,
    });
  });

  test('the threshold is ten: nine password failures leave sign-in open and the tenth locks it', async () => {
    await failMany({ count: LAST_FAILURE_BEFORE_LOCK });
    expect(await readOperator()).toMatchObject({ password_failed_attempts: LAST_FAILURE_BEFORE_LOCK, password_locked_until: null });
    await failMany({ count: 1 });
    expect(await readOperator()).toMatchObject({
      password_failed_attempts: LOCKING_FAILURE,
      password_locked_until: NOW + BACKOFFICE_LOCKOUT_MS,
      failed_attempts: 0,
      locked_until: null,
    });
    expect(await lockedAuditRows()).toBe(1);
  });

  test('a password-step flood locks the password step and never the step-up or the code step', async () => {
    await failMany({ count: BACKOFFICE_LOCKOUT_THRESHOLD });
    const refused = await signInWithCode({ code: await validCode({}) });
    expect(refused.headers.get('location')).toBe(SIGN_IN_FAILED_LOCATION);
    const outcome = await verifyStepUp({
      env: backofficeEnv({}),
      code: await validCode({}),
      now: Date.now(),
      clientAddress: CLIENT_ADDRESS,
      targetKind: BackofficeAuditTargetKind.Number,
      targetId: 'num_1',
    });
    expect(outcome).toBe(StepUpOutcome.Accepted);
    const { pendingToken, csrf } = await openPendingFor({ now: Date.now() });
    const codeResponse = await postCodeStep({ code: await validCode({ now: Date.now() + TOTP_PERIOD_MS }), pendingToken, csrf });
    expect(codeResponse.headers.get('location')).toBe('/');
  });

  test('ten wrong codes still lock the code counter, the step-up and the password step', async () => {
    await failManyCodes({ count: BACKOFFICE_LOCKOUT_THRESHOLD });
    expect(await readOperator()).toMatchObject({
      failed_attempts: BACKOFFICE_LOCKOUT_THRESHOLD,
      locked_until: NOW + BACKOFFICE_LOCKOUT_MS,
    });
    const refused = await signInWithCode({ code: await validCode({}) });
    expect(refused.headers.get('location')).toBe(SIGN_IN_FAILED_LOCATION);
    expect(await lockedAuditRows()).toBe(1);
  });

  test('a password-locked operator is refused with correct factors and nothing changes', async () => {
    await failMany({ count: BACKOFFICE_LOCKOUT_THRESHOLD });
    const response = await signInWithCode({ code: await validCode({}) });
    expect(response.headers.get('location')).toBe(SIGN_IN_FAILED_LOCATION);
    expect((await readOperator()).password_failed_attempts).toBe(BACKOFFICE_LOCKOUT_THRESHOLD);
    expect(await lockedAuditRows()).toBe(1);
  });

  test('after the password lock expires a wrong attempt starts a fresh count and a correct one signs in', async () => {
    await failMany({ count: BACKOFFICE_LOCKOUT_THRESHOLD });
    vi.setSystemTime(NOW + BACKOFFICE_LOCKOUT_MS + SECOND_MS);
    await failMany({ count: 1 });
    expect(await readOperator()).toMatchObject({ password_failed_attempts: 1, password_locked_until: null });
    const response = await signInWithCode({ code: await validCode({ now: Date.now() }) });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect((await readOperator()).password_failed_attempts).toBe(0);
  });

  test('a right password after five failures resets the password count', async () => {
    await failMany({ count: FIVE_FAILURES });
    await signInWithCode({ code: await validCode({}) });
    expect((await readOperator()).password_failed_attempts).toBe(0);
  });

  test('five concurrent password failures lose no increment', async () => {
    const { csrf } = await openSignInForm({});
    await Promise.all(
      Array.from({ length: FIVE_FAILURES }, () => postPasswordStep({ email: BACKOFFICE_TEST_EMAIL, password: WRONG_PASSWORD, csrf })),
    );
    expect((await readOperator()).password_failed_attempts).toBe(FIVE_FAILURES);
  });
});
