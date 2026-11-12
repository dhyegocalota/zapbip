import { beforeEach, describe, expect, test } from 'vitest';
import { sha256Hex } from '../../src/adapters/platform/hash';
import { testEnv } from '../support/workers-env';
import {
  BACKOFFICE_TEST_EMAIL,
  CSRF_COOKIE,
  openSignInForm,
  postPasswordStep,
  readOperator,
  requestBackoffice,
  resetBackoffice,
  SESSION_COOKIE,
  SIGN_IN_FAILED_LOCATION,
  signIn,
  signInWithCode,
  UNKNOWN_EMAIL,
  validCode,
  WRONG_CODE,
  WRONG_PASSWORD,
} from './backoffice-auth-fixtures';

const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;

beforeEach(resetBackoffice);

async function sessionDigests(): Promise<string[]> {
  const { results } = await testEnv.CONNECTIONS.prepare('SELECT token_digest FROM backoffice_sessions').all<{ token_digest: string }>();
  return results.map((row) => row.token_digest);
}

describe('sign-in page', () => {
  test('renders the email and password form and sets the csrf cookie it carries', async () => {
    const { csrf, response } = await openSignInForm({});
    const html = await response.text();
    expect(response.status).toBe(STATUS_OK);
    expect(html).toContain('action="/sign-in"');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
    expect(html).not.toContain('name="code"');
    expect(html).toContain(`name="csrf" value="${csrf}"`);
    const csrfCookie = response.headers.getSetCookie().find((line) => line.startsWith(`${CSRF_COOKIE}=`));
    ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/'].forEach((attribute) => expect(csrfCookie).toContain(attribute));
  });
});

describe('sign-in', () => {
  test('the right pair and code open a session in a hardened cookie', async () => {
    const response = await signInWithCode({ code: await validCode({}) });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe('/');
    const sessionCookie = response.headers.getSetCookie().find((line) => line.startsWith(`${SESSION_COOKIE}=`));
    expect(sessionCookie?.split('; ')).toEqual(expect.arrayContaining(['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/']));
    expect(sessionCookie).not.toMatch(/Domain/i);
  });

  test('stores only a digest of the session token', async () => {
    const { sessionToken } = await signIn({});
    expect(await sessionDigests()).toEqual([await sha256Hex({ value: sessionToken })]);
  });

  test('a wrong password, an unknown email and a wrong code are each one failure redirect and each counts', async () => {
    const { csrf } = await openSignInForm({});
    const wrongPassword = await postPasswordStep({ email: BACKOFFICE_TEST_EMAIL, password: WRONG_PASSWORD, csrf });
    const unknownEmail = await postPasswordStep({ email: UNKNOWN_EMAIL, password: WRONG_PASSWORD, csrf });
    const wrongCode = await signInWithCode({ code: WRONG_CODE, csrf });
    expect([wrongPassword, unknownEmail, wrongCode].map((response) => [response.status, response.headers.get('location')])).toEqual(
      Array.from({ length: 3 }, () => [STATUS_SEE_OTHER, SIGN_IN_FAILED_LOCATION]),
    );
    const bodies = await Promise.all([wrongPassword, unknownEmail, wrongCode].map((response) => response.text()));
    expect(bodies[1]).toBe(bodies[0]);
    expect(bodies[2]).toBe(bodies[0]);
    expect(await readOperator()).toMatchObject({ password_failed_attempts: 2, failed_attempts: 1 });
    expect(await sessionDigests()).toEqual([]);
  });

  test('the failure page is the form again and never names the failing factor', async () => {
    const failed = await postPasswordStep({ email: UNKNOWN_EMAIL, password: WRONG_PASSWORD });
    const response = await requestBackoffice({ path: failed.headers.get('location')! });
    const html = await response.text();
    expect(response.status).toBe(STATUS_OK);
    expect(html).toContain('action="/sign-in"');
    expect(html).toContain('role="alert"');
    expect(html).not.toContain(UNKNOWN_EMAIL);
    expect(html).not.toContain(WRONG_PASSWORD);
  });

  test('a signed-in browser is sent from the sign-in page to the home page', async () => {
    const { sessionToken } = await signIn({});
    const response = await requestBackoffice({ path: '/sign-in', cookies: { [SESSION_COOKIE]: sessionToken } });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe('/');
  });
});

describe('a failed sign-in', () => {
  test('is a 303 to a GET, and reloading that GET does not count another failure', async () => {
    const failed = await signInWithCode({ code: WRONG_CODE });
    expect(failed.status).toBe(STATUS_SEE_OTHER);
    await requestBackoffice({ path: SIGN_IN_FAILED_LOCATION });
    await requestBackoffice({ path: SIGN_IN_FAILED_LOCATION });
    expect((await readOperator()).failed_attempts).toBe(1);
  });
});

describe('one-time codes', () => {
  test('the same valid code a second time is refused', async () => {
    const code = await validCode({});
    const first = await signInWithCode({ code });
    const second = await signInWithCode({ code });
    expect([first, second].map((response) => response.headers.get('location'))).toEqual(['/', SIGN_IN_FAILED_LOCATION]);
  });

  test('two concurrent sign-ins with one code open exactly one session', async () => {
    const code = await validCode({});
    const { csrf } = await openSignInForm({});
    const responses = await Promise.all([signInWithCode({ code, csrf }), signInWithCode({ code, csrf })]);
    expect(responses.map((response) => response.headers.get('location')).sort()).toEqual(['/', SIGN_IN_FAILED_LOCATION]);
    expect(await sessionDigests()).toHaveLength(1);
  });
});
