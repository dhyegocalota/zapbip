import { beforeEach, describe, expect, test } from 'vitest';
import { csrfTokenOf } from '../../src/backoffice/auth/csrf';
import { testEnv } from '../support/workers-env';
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_TEST_KEY,
  CSRF_COOKIE,
  openSignInForm,
  readOperator,
  requestBackoffice,
  resetBackoffice,
  SESSION_COOKIE,
  signIn,
  validCode,
} from './backoffice-auth-fixtures';

const STATUS_FORBIDDEN = 403;
const EVIL_ORIGIN = 'https://evil.example';

beforeEach(resetBackoffice);

async function sessionCount(): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM backoffice_sessions').first<{ total: number }>();
  return row!.total;
}

async function signedInPost(input: {
  path: string;
  origin: string | null;
  csrf?: string;
}): Promise<{ response: Response; sessionToken: string }> {
  const { sessionToken } = await signIn({});
  const csrf = input.csrf === undefined ? await csrfTokenOf({ sessionToken }) : input.csrf;
  const response = await requestBackoffice({
    path: input.path,
    method: 'POST',
    form: { csrf },
    cookies: { [SESSION_COOKIE]: sessionToken },
    headers: input.origin === null ? {} : { Origin: input.origin },
  });
  return { response, sessionToken };
}

describe('csrf', () => {
  test('a sign-out without Origin is refused and the session survives', async () => {
    const { response } = await signedInPost({ path: '/sign-out', origin: null });
    expect(response.status).toBe(STATUS_FORBIDDEN);
    expect(await sessionCount()).toBe(1);
  });

  test('a foreign Origin with a valid token is refused', async () => {
    const { response } = await signedInPost({ path: '/numbers/connect', origin: EVIL_ORIGIN });
    expect(response.status).toBe(STATUS_FORBIDDEN);
  });

  test("another session's token is refused", async () => {
    const otherToken = await csrfTokenOf({ sessionToken: 'another-session-token' });
    const { response } = await signedInPost({ path: '/sign-out', origin: BACKOFFICE_ORIGIN, csrf: otherToken });
    expect(response.status).toBe(STATUS_FORBIDDEN);
    expect(await sessionCount()).toBe(1);
  });

  test('a missing token field is refused', async () => {
    const { sessionToken } = await signIn({});
    const response = await requestBackoffice({
      path: '/sign-out',
      method: 'POST',
      form: {},
      cookies: { [SESSION_COOKIE]: sessionToken },
      headers: { Origin: BACKOFFICE_ORIGIN },
    });
    expect(response.status).toBe(STATUS_FORBIDDEN);
  });

  test('a sign-in whose field differs from its cookie is refused and counts nothing', async () => {
    const { csrf } = await openSignInForm({});
    const response = await requestBackoffice({
      path: '/sign-in',
      method: 'POST',
      form: { key: BACKOFFICE_TEST_KEY, code: await validCode({}), csrf: `${csrf}x` },
      cookies: { [CSRF_COOKIE]: csrf },
      headers: { Origin: BACKOFFICE_ORIGIN },
    });
    expect(response.status).toBe(STATUS_FORBIDDEN);
    expect((await readOperator()).failed_attempts).toBe(0);
  });

  test('a sign-in without Origin is refused', async () => {
    const { csrf } = await openSignInForm({});
    const response = await requestBackoffice({
      path: '/sign-in',
      method: 'POST',
      form: { key: BACKOFFICE_TEST_KEY, code: await validCode({}), csrf },
      cookies: { [CSRF_COOKIE]: csrf },
    });
    expect(response.status).toBe(STATUS_FORBIDDEN);
  });
});
