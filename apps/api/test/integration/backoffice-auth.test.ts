import { beforeEach, describe, expect, test } from 'vitest';
import { sha256Hex } from '../../src/adapters/platform/hash';
import { testEnv } from '../support/workers-env';
import {
  BACKOFFICE_TEST_KEY,
  CSRF_COOKIE,
  openSignInForm,
  postSignIn,
  readOperator,
  requestBackoffice,
  resetBackoffice,
  SESSION_COOKIE,
  signIn,
  validCode,
  WRONG_CODE,
  WRONG_KEY,
} from './backoffice-auth-fixtures';

const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;
const STATUS_UNAUTHORIZED = 401;

beforeEach(resetBackoffice);

async function sessionDigests(): Promise<string[]> {
  const { results } = await testEnv.CONNECTIONS.prepare('SELECT token_digest FROM backoffice_sessions').all<{ token_digest: string }>();
  return results.map((row) => row.token_digest);
}

describe('sign-in page', () => {
  test('renders the two-field form and sets the csrf cookie it carries', async () => {
    const { csrf, response } = await openSignInForm({});
    const html = await response.text();
    expect(response.status).toBe(STATUS_OK);
    expect(html).toContain('action="/sign-in"');
    expect(html).toContain('name="key"');
    expect(html).toContain('name="code"');
    expect(html).toContain(`name="csrf" value="${csrf}"`);
    const csrfCookie = response.headers.getSetCookie().find((line) => line.startsWith(`${CSRF_COOKIE}=`));
    ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/'].forEach((attribute) => expect(csrfCookie).toContain(attribute));
  });
});

describe('sign-in', () => {
  test('the right key and code open a session in a hardened cookie', async () => {
    const response = await postSignIn({ key: BACKOFFICE_TEST_KEY, code: await validCode({}) });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe('/');
    const sessionCookie = response.headers.getSetCookie().find((line) => line.startsWith(`${SESSION_COOKIE}=`));
    expect(sessionCookie).toContain('Secure');
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Strict');
    expect(sessionCookie).toContain('Path=/');
    expect(sessionCookie).not.toMatch(/Domain/i);
  });

  test('stores only a digest of the session token', async () => {
    const { sessionToken } = await signIn({});
    expect(await sessionDigests()).toEqual([await sha256Hex({ value: sessionToken })]);
  });

  test('a wrong key, a wrong code and both are one identical 401 and count as failures', async () => {
    const { csrf } = await openSignInForm({});
    const wrongKey = await postSignIn({ key: WRONG_KEY, code: await validCode({}), csrf });
    const wrongCode = await postSignIn({ key: BACKOFFICE_TEST_KEY, code: WRONG_CODE, csrf });
    const wrongBoth = await postSignIn({ key: WRONG_KEY, code: WRONG_CODE, csrf });
    expect([wrongKey.status, wrongCode.status, wrongBoth.status]).toEqual([STATUS_UNAUTHORIZED, STATUS_UNAUTHORIZED, STATUS_UNAUTHORIZED]);
    const bodies = await Promise.all([wrongKey, wrongCode, wrongBoth].map((response) => response.text()));
    expect(bodies[1]).toBe(bodies[0]);
    expect(bodies[2]).toBe(bodies[0]);
    expect((await readOperator()).failed_attempts).toBe(3);
    expect(await sessionDigests()).toEqual([]);
  });

  test('the failure page is the form again and never names the failing factor', async () => {
    const response = await postSignIn({ key: WRONG_KEY, code: WRONG_CODE });
    const html = await response.text();
    expect(html).toContain('action="/sign-in"');
    expect(html).toContain('role="alert"');
    expect(html).not.toContain(WRONG_KEY);
  });

  test('a signed-in browser is sent from the sign-in page to the home page', async () => {
    const { sessionToken } = await signIn({});
    const response = await requestBackoffice({ path: '/sign-in', cookies: { [SESSION_COOKIE]: sessionToken } });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe('/');
  });
});

describe('one-time codes', () => {
  test('the same valid code a second time is refused (pin: the read-then-check path already refuses it)', async () => {
    const code = await validCode({});
    const first = await postSignIn({ key: BACKOFFICE_TEST_KEY, code });
    const second = await postSignIn({ key: BACKOFFICE_TEST_KEY, code });
    expect([first.status, second.status]).toEqual([STATUS_SEE_OTHER, STATUS_UNAUTHORIZED]);
  });

  test('two concurrent sign-ins with one code open exactly one session', async () => {
    const code = await validCode({});
    const { csrf } = await openSignInForm({});
    const responses = await Promise.all([
      postSignIn({ key: BACKOFFICE_TEST_KEY, code, csrf }),
      postSignIn({ key: BACKOFFICE_TEST_KEY, code, csrf }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([STATUS_SEE_OTHER, STATUS_UNAUTHORIZED]);
    expect(await sessionDigests()).toHaveLength(1);
  });
});
