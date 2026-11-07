import { SECOND_MS } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { BACKOFFICE_LOCKOUT_MS, BACKOFFICE_LOCKOUT_THRESHOLD } from '../../src/contract/constants';
import { testEnv } from '../support/workers-env';
import {
  BACKOFFICE_TEST_KEY,
  openSignInForm,
  postSignIn,
  readOperator,
  resetBackoffice,
  SIGN_IN_FAILED_LOCATION,
  validCode,
  WRONG_CODE,
  WRONG_KEY,
} from './backoffice-auth-fixtures';

const STATUS_SEE_OTHER = 303;
const NOW = Date.UTC(2026, 10, 7, 12);
const LOCKED_ACTION = 'sign_in.locked';
const FIVE_FAILURES = 5;
const TWENTY_WRONG_KEYS = 20;
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
    await postSignIn({ key: BACKOFFICE_TEST_KEY, code: WRONG_CODE });
  }
}

async function failManyKeys(input: { count: number }): Promise<void> {
  for (let attempt = 0; attempt < input.count; attempt += 1) {
    await postSignIn({ key: WRONG_KEY, code: WRONG_CODE });
  }
}

async function lockedAuditRows(): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM backoffice_audit WHERE action = ?')
    .bind(LOCKED_ACTION)
    .first<{ total: number }>();
  return row!.total;
}

describe('lockout', () => {
  test('twenty wrong keys never lock the owner out: they are audited but not counted', async () => {
    await failManyKeys({ count: TWENTY_WRONG_KEYS });
    expect(await readOperator()).toMatchObject({ failed_attempts: 0, locked_until: null });
    const failedRows = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM backoffice_audit WHERE action = ?')
      .bind('sign_in.failed')
      .first<{ total: number }>();
    expect(failedRows!.total).toBe(TWENTY_WRONG_KEYS);
    const response = await postSignIn({ key: BACKOFFICE_TEST_KEY, code: await validCode({}) });
    expect(response.headers.get('location')).toBe('/');
  });

  test('the threshold is ten: nine failures leave the operator open and the tenth locks', async () => {
    await failMany({ count: LAST_FAILURE_BEFORE_LOCK });
    expect(await readOperator()).toMatchObject({ failed_attempts: LAST_FAILURE_BEFORE_LOCK, locked_until: null });
    await failMany({ count: 1 });
    expect(await readOperator()).toMatchObject({ failed_attempts: LOCKING_FAILURE, locked_until: NOW + BACKOFFICE_LOCKOUT_MS });
  });

  test('nine failures leave the operator unlocked and the tenth locks for the lockout period', async () => {
    await failMany({ count: BACKOFFICE_LOCKOUT_THRESHOLD - 1 });
    expect((await readOperator()).locked_until).toBeNull();
    await failMany({ count: 1 });
    expect((await readOperator()).locked_until).toBe(NOW + BACKOFFICE_LOCKOUT_MS);
    expect(await lockedAuditRows()).toBe(1);
  });

  test('a locked operator is refused with correct factors and nothing changes', async () => {
    await failMany({ count: BACKOFFICE_LOCKOUT_THRESHOLD });
    const response = await postSignIn({ key: BACKOFFICE_TEST_KEY, code: await validCode({}) });
    expect(response.headers.get('location')).toBe(SIGN_IN_FAILED_LOCATION);
    expect((await readOperator()).failed_attempts).toBe(BACKOFFICE_LOCKOUT_THRESHOLD);
    expect(await lockedAuditRows()).toBe(1);
  });

  test('after the lock expires a wrong attempt starts a fresh count and a correct one signs in', async () => {
    await failMany({ count: BACKOFFICE_LOCKOUT_THRESHOLD });
    vi.setSystemTime(NOW + BACKOFFICE_LOCKOUT_MS + SECOND_MS);
    await failMany({ count: 1 });
    expect(await readOperator()).toMatchObject({ failed_attempts: 1, locked_until: null });
    const response = await postSignIn({ key: BACKOFFICE_TEST_KEY, code: await validCode({ now: Date.now() }) });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect((await readOperator()).failed_attempts).toBe(0);
  });

  test('a success after five failures resets the count', async () => {
    await failMany({ count: FIVE_FAILURES });
    await postSignIn({ key: BACKOFFICE_TEST_KEY, code: await validCode({}) });
    expect((await readOperator()).failed_attempts).toBe(0);
  });

  test('five concurrent failures lose no increment', async () => {
    const { csrf } = await openSignInForm({});
    await Promise.all(Array.from({ length: FIVE_FAILURES }, () => postSignIn({ key: BACKOFFICE_TEST_KEY, code: WRONG_CODE, csrf })));
    expect((await readOperator()).failed_attempts).toBe(FIVE_FAILURES);
  });
});
