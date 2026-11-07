import { SECOND_MS } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { StepUpOutcome, verifyStepUp } from '../../src/backoffice/auth/step-up';
import { TOTP_PERIOD_MS, BACKOFFICE_LOCKOUT_THRESHOLD } from '../../src/contract/constants';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import { testEnv } from '../support/workers-env';
import {
  BACKOFFICE_TEST_KEY,
  backofficeEnv,
  CLIENT_ADDRESS,
  postSignIn,
  SIGN_IN_FAILED_LOCATION,
  readOperator,
  resetBackoffice,
  validCode,
  WRONG_CODE,
} from './backoffice-auth-fixtures';

const NOW = Date.UTC(2026, 10, 7, 12);
const TARGET_KIND = 'number';
const TARGET_ID = 'num_1';
const STEP_UP_KEY = `step-up:${CLIENT_ADDRESS}`;

beforeEach(async () => {
  await resetBackoffice();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function stepUp(input: { code: string; env?: ReturnType<typeof backofficeEnv> }): Promise<StepUpOutcome> {
  return verifyStepUp({
    env: input.env === undefined ? backofficeEnv({}) : input.env,
    code: input.code,
    now: Date.now(),
    clientAddress: CLIENT_ADDRESS,
    targetKind: TARGET_KIND,
    targetId: TARGET_ID,
  });
}

async function auditCount(input: { action: string }): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM backoffice_audit WHERE action = ?')
    .bind(input.action)
    .first<{ total: number }>();
  return row!.total;
}

describe('step-up', () => {
  test('a missing code is rejected', async () => {
    expect(await stepUp({ code: '' })).toBe(StepUpOutcome.Rejected);
  });

  test('a code already used at sign-in is rejected', async () => {
    const code = await validCode({});
    await postSignIn({ key: BACKOFFICE_TEST_KEY, code });
    expect(await stepUp({ code })).toBe(StepUpOutcome.Rejected);
  });

  test('a wrong code is rejected, counts as a failure and is audited with its target', async () => {
    expect(await stepUp({ code: WRONG_CODE })).toBe(StepUpOutcome.Rejected);
    expect((await readOperator()).failed_attempts).toBe(1);
    const row = await testEnv.CONNECTIONS.prepare('SELECT target_kind, target_id FROM backoffice_audit WHERE action = ?')
      .bind('step_up.failed')
      .first<{ target_kind: string; target_id: string }>();
    expect(row).toEqual({ target_kind: TARGET_KIND, target_id: TARGET_ID });
  });

  test('ten wrong codes lock the operator once, and a correct code is then rejected unconsumed', async () => {
    for (let attempt = 0; attempt < BACKOFFICE_LOCKOUT_THRESHOLD; attempt += 1) await stepUp({ code: WRONG_CODE });
    expect((await readOperator()).locked_until).not.toBeNull();
    expect(await auditCount({ action: 'sign_in.locked' })).toBe(1);
    const stepBefore = (await readOperator()).last_totp_step;
    expect(await stepUp({ code: await validCode({}) })).toBe(StepUpOutcome.Rejected);
    expect((await readOperator()).last_totp_step).toBe(stepBefore);
    const signIn = await postSignIn({ key: BACKOFFICE_TEST_KEY, code: await validCode({}) });
    expect(signIn.headers.get('location')).toBe(SIGN_IN_FAILED_LOCATION);
  });

  test('a correct code is accepted, consumed and resets the failure count', async () => {
    await stepUp({ code: WRONG_CODE });
    const code = await validCode({});
    expect(await stepUp({ code })).toBe(StepUpOutcome.Accepted);
    expect(await readOperator()).toMatchObject({ failed_attempts: 0, last_totp_step: Math.floor(NOW / TOTP_PERIOD_MS) });
    expect(await stepUp({ code })).toBe(StepUpOutcome.Rejected);
  });

  test('a refused step-up key is rate limited with nothing consumed or written', async () => {
    const limiter = createFakeRateLimiter({ limit: 0 });
    const outcome = await stepUp({ code: await validCode({ now: NOW + TOTP_PERIOD_MS + SECOND_MS }), env: backofficeEnv({ limiter }) });
    expect(outcome).toBe(StepUpOutcome.RateLimited);
    expect(limiter.calls).toEqual([STEP_UP_KEY]);
    expect(await readOperator()).toMatchObject({ failed_attempts: 0, last_totp_step: 0 });
    expect(await auditCount({ action: 'step_up.failed' })).toBe(0);
  });
});
