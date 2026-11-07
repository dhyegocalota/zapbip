import { MINUTE_MS, HOUR_MS } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { csrfTokenOf } from '../../src/backoffice/auth/csrf';
import { BACKOFFICE_SESSION_IDLE_MS, BACKOFFICE_SESSION_MAX_MS } from '../../src/contract/constants';
import { testEnv } from '../support/workers-env';
import { BACKOFFICE_ORIGIN, requestBackoffice, resetBackoffice, SESSION_COOKIE, signIn } from './backoffice-auth-fixtures';

const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;
const STATUS_UNAUTHORIZED = 401;
const NOW = Date.UTC(2026, 10, 7, 12);
const PROTECTED_PATH = '/numbers';
const TEN_REQUESTS = 10;
const SESSION_REFRESH_STEP_MS = 10 * MINUTE_MS;
const ONE_MINUTE_AND_ONE_SECOND_MS = MINUTE_MS + 1_000;

beforeEach(async () => {
  await resetBackoffice();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function getAs(input: { sessionToken: string; path?: string }): Promise<Response> {
  return requestBackoffice({ path: input.path === undefined ? '/' : input.path, cookies: { [SESSION_COOKIE]: input.sessionToken } });
}

async function lastSeenValues(): Promise<number[]> {
  const { results } = await testEnv.CONNECTIONS.prepare('SELECT last_seen_at FROM backoffice_sessions').all<{ last_seen_at: number }>();
  return results.map((row) => row.last_seen_at);
}

describe('sessions', () => {
  test('a session idle past the idle timeout redirects to sign-in', async () => {
    const { sessionToken } = await signIn({});
    vi.setSystemTime(NOW + BACKOFFICE_SESSION_IDLE_MS + MINUTE_MS);
    const response = await getAs({ sessionToken, path: PROTECTED_PATH });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toMatch(/^\/sign-in/);
  });

  test('a session past the absolute lifetime redirects even with steady activity', async () => {
    const { sessionToken } = await signIn({});
    const steps = Math.floor(BACKOFFICE_SESSION_MAX_MS / SESSION_REFRESH_STEP_MS);
    for (let step = 1; step <= steps; step += 1) {
      vi.setSystemTime(NOW + step * SESSION_REFRESH_STEP_MS);
      expect((await getAs({ sessionToken })).status).toBe(STATUS_OK);
    }
    vi.setSystemTime(NOW + BACKOFFICE_SESSION_MAX_MS + MINUTE_MS);
    const response = await getAs({ sessionToken, path: PROTECTED_PATH });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toMatch(/^\/sign-in/);
  });

  test('no cookie redirects a page to sign-in', async () => {
    const response = await requestBackoffice({ path: PROTECTED_PATH });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe('/sign-in');
  });

  test('an expired session answers 401 to a POST', async () => {
    const { sessionToken } = await signIn({});
    vi.setSystemTime(NOW + HOUR_MS);
    const response = await requestBackoffice({
      path: '/sign-out',
      method: 'POST',
      form: { csrf: await csrfTokenOf({ sessionToken }) },
      cookies: { [SESSION_COOKIE]: sessionToken },
      headers: { Origin: BACKOFFICE_ORIGIN },
    });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
  });

  test('sign-out deletes the row, expires the cookie and the old cookie no longer works', async () => {
    const { sessionToken } = await signIn({});
    const response = await requestBackoffice({
      path: '/sign-out',
      method: 'POST',
      form: { csrf: await csrfTokenOf({ sessionToken }) },
      cookies: { [SESSION_COOKIE]: sessionToken },
      headers: { Origin: BACKOFFICE_ORIGIN },
    });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe('/sign-in?notice=SignedOut');
    expect(response.headers.getSetCookie().find((line) => line.startsWith(`${SESSION_COOKIE}=`))).toMatch(/Max-Age=0|Expires=/);
    expect(await lastSeenValues()).toEqual([]);
    expect((await getAs({ sessionToken, path: PROTECTED_PATH })).status).toBe(STATUS_SEE_OTHER);
  });

  test('last_seen_at is written at most once a minute', async () => {
    const { sessionToken } = await signIn({});
    await Promise.all(Array.from({ length: TEN_REQUESTS }, () => getAs({ sessionToken })));
    expect(await lastSeenValues()).toEqual([NOW]);
    vi.setSystemTime(NOW + ONE_MINUTE_AND_ONE_SECOND_MS);
    await Promise.all(Array.from({ length: TEN_REQUESTS }, () => getAs({ sessionToken })));
    expect(await lastSeenValues()).toEqual([NOW + ONE_MINUTE_AND_ONE_SECOND_MS]);
  });
});
