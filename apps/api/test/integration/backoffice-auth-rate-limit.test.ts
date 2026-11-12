import { beforeEach, describe, expect, test } from 'vitest';
import { testEnv } from '../support/workers-env';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import {
  backofficeEnv,
  CLIENT_ADDRESS,
  openSignInForm,
  signInWithCode,
  readOperator,
  resetBackoffice,
  validCode,
} from './backoffice-auth-fixtures';

const STATUS_OK = 200;
const STATUS_TOO_MANY_REQUESTS = 429;
const RETRY_AFTER_SECONDS = '60';

beforeEach(resetBackoffice);

async function rowCount(input: { table: string }): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare(`SELECT COUNT(*) AS total FROM ${input.table}`).first<{ total: number }>();
  return row!.total;
}

describe('sign-in rate limit', () => {
  test('a refused sign-in answers 429 with Retry-After and writes nothing', async () => {
    const limiter = createFakeRateLimiter({ limit: 0 });
    const env = backofficeEnv({ limiter });
    const response = await signInWithCode({ code: await validCode({}), env });
    expect(response.status).toBe(STATUS_TOO_MANY_REQUESTS);
    expect(response.headers.get('retry-after')).toBe(RETRY_AFTER_SECONDS);
    expect(await rowCount({ table: 'backoffice_sessions' })).toBe(0);
    expect(await rowCount({ table: 'backoffice_audit' })).toBe(0);
    expect((await readOperator()).failed_attempts).toBe(0);
  });

  test('the limiter is keyed by the client address', async () => {
    const limiter = createFakeRateLimiter({ limit: 0 });
    await signInWithCode({ code: await validCode({}), env: backofficeEnv({ limiter }) });
    expect(limiter.calls).toEqual([CLIENT_ADDRESS]);
  });

  test('opening the sign-in page is not limited', async () => {
    const limiter = createFakeRateLimiter({ limit: 0 });
    const { response } = await openSignInForm({ env: backofficeEnv({ limiter }) });
    expect(response.status).toBe(STATUS_OK);
    expect(limiter.calls).toEqual([]);
  });
});
