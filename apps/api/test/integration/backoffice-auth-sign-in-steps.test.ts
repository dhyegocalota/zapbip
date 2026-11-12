import { beforeEach, describe, expect, test } from 'vitest';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import {
  backofficeEnv,
  BACKOFFICE_TEST_EMAIL,
  BACKOFFICE_TEST_PASSWORD,
  cookieValueOf,
  CSRF_COOKIE,
  openPendingSignIn,
  openSignInForm,
  PENDING_COOKIE,
  postCodeStep,
  postPasswordStep,
  readOperator,
  requestBackoffice,
  resetBackoffice,
  SESSION_COOKIE,
  SIGN_IN_FAILED_LOCATION,
  UNKNOWN_EMAIL,
  validCode,
  WRONG_CODE,
  WRONG_PASSWORD,
} from './backoffice-auth-fixtures';

const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;
const STATUS_TOO_MANY_REQUESTS = 429;
const CODE_PATH = '/sign-in/code';
const SIGN_IN_PATH = '/sign-in';
const OLD_STYLE_KEY = `zb_bo_${'K'.repeat(43)}`;

beforeEach(resetBackoffice);

function setCookieLineOf(input: { response: Response; name: string }): string {
  const line = input.response.headers.getSetCookie().find((candidate) => candidate.startsWith(`${input.name}=`));
  if (line === undefined) throw new Error(`no Set-Cookie for ${input.name}`);
  return line;
}

describe('the password step', () => {
  test('a right pair is a 303 to the code page with a hardened pending cookie', async () => {
    const response = await postPasswordStep({ email: BACKOFFICE_TEST_EMAIL, password: BACKOFFICE_TEST_PASSWORD });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe(CODE_PATH);
    const attributes = setCookieLineOf({ response, name: PENDING_COOKIE }).split('; ');
    ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/', 'Max-Age=300'].forEach((attribute) => expect(attributes).toContain(attribute));
    expect(attributes.some((attribute) => /^Domain/i.test(attribute))).toBe(false);
    expect(response.headers.getSetCookie().some((line) => line.startsWith(`${SESSION_COOKIE}=`))).toBe(false);
  });

  test('a wrong password and an unknown email are one identical failure', async () => {
    const { csrf } = await openSignInForm({});
    const wrongPassword = await postPasswordStep({ email: BACKOFFICE_TEST_EMAIL, password: WRONG_PASSWORD, csrf });
    const unknownEmail = await postPasswordStep({ email: UNKNOWN_EMAIL, password: BACKOFFICE_TEST_PASSWORD, csrf });
    expect([wrongPassword.status, unknownEmail.status]).toEqual([STATUS_SEE_OTHER, STATUS_SEE_OTHER]);
    expect([wrongPassword, unknownEmail].map((response) => response.headers.get('location'))).toEqual([
      SIGN_IN_FAILED_LOCATION,
      SIGN_IN_FAILED_LOCATION,
    ]);
    expect(await wrongPassword.text()).toBe(await unknownEmail.text());
    expect([wrongPassword, unknownEmail].map((response) => cookieValueOf({ response, name: PENDING_COOKIE }))).toEqual([null, null]);
    expect(await readOperator()).toMatchObject({ password_failed_attempts: 2, failed_attempts: 0 });
  });

  test('the old key typed into the password field is refused', async () => {
    const response = await postPasswordStep({ email: BACKOFFICE_TEST_EMAIL, password: OLD_STYLE_KEY });
    expect(response.headers.get('location')).toBe(SIGN_IN_FAILED_LOCATION);
  });

  test('a rate-limited password step is a 429', async () => {
    const env = backofficeEnv({ limiter: createFakeRateLimiter({ limit: 0 }) });
    const response = await postPasswordStep({ email: BACKOFFICE_TEST_EMAIL, password: BACKOFFICE_TEST_PASSWORD, env });
    expect(response.status).toBe(STATUS_TOO_MANY_REQUESTS);
  });

  test('a missing field is a 400', async () => {
    const { csrf } = await openSignInForm({});
    const response = await requestBackoffice({
      path: SIGN_IN_PATH,
      method: 'POST',
      form: { email: BACKOFFICE_TEST_EMAIL, csrf },
      cookies: { [CSRF_COOKIE]: csrf },
      headers: { Origin: 'http://backoffice.localhost:8787' },
    });
    expect(response.status).toBe(400);
  });
});

describe('the code page', () => {
  test('without a live pending cookie it sends the browser back to sign-in', async () => {
    const withoutCookie = await requestBackoffice({ path: CODE_PATH });
    const withUnknownCookie = await requestBackoffice({ path: CODE_PATH, cookies: { [PENDING_COOKIE]: 'unknown-token' } });
    expect([withoutCookie, withUnknownCookie].map((response) => [response.status, response.headers.get('location')])).toEqual([
      [STATUS_SEE_OTHER, SIGN_IN_PATH],
      [STATUS_SEE_OTHER, SIGN_IN_PATH],
    ]);
  });

  test('with a live pending cookie it renders only the code field and a csrf cookie', async () => {
    const { pendingToken } = await openPendingSignIn({});
    const response = await requestBackoffice({ path: CODE_PATH, cookies: { [PENDING_COOKIE]: pendingToken } });
    const html = await response.text();
    expect(response.status).toBe(STATUS_OK);
    expect(html).toContain('action="/sign-in/code"');
    expect(html).toContain('name="code"');
    expect(html).not.toContain('name="email"');
    expect(html).not.toContain('name="password"');
    expect(cookieValueOf({ response, name: CSRF_COOKIE })).not.toBeNull();
  });

  test('reading it does not use up the pending state', async () => {
    const { pendingToken, csrf } = await openPendingSignIn({});
    await requestBackoffice({ path: CODE_PATH, cookies: { [PENDING_COOKIE]: pendingToken } });
    const response = await postCodeStep({ code: await validCode({}), pendingToken, csrf });
    expect(response.headers.get('location')).toBe('/');
  });

  test('a signed-in browser is sent to the home page', async () => {
    const { pendingToken, csrf } = await openPendingSignIn({});
    const signedIn = await postCodeStep({ code: await validCode({}), pendingToken, csrf });
    const sessionToken = cookieValueOf({ response: signedIn, name: SESSION_COOKIE })!;
    const response = await requestBackoffice({ path: CODE_PATH, cookies: { [SESSION_COOKIE]: sessionToken } });
    expect(response.headers.get('location')).toBe('/');
  });
});

describe('the code step', () => {
  test('a right code opens a hardened session and clears the pending cookie', async () => {
    const { pendingToken, csrf } = await openPendingSignIn({});
    const response = await postCodeStep({ code: await validCode({}), pendingToken, csrf });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe('/');
    const attributes = setCookieLineOf({ response, name: SESSION_COOKIE }).split('; ');
    ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/'].forEach((attribute) => expect(attributes).toContain(attribute));
    expect(setCookieLineOf({ response, name: PENDING_COOKIE })).toContain('Max-Age=0');
  });

  test('a wrong code clears the pending cookie and the same cookie cannot be replayed', async () => {
    const { pendingToken, csrf } = await openPendingSignIn({});
    const wrong = await postCodeStep({ code: WRONG_CODE, pendingToken, csrf });
    expect(wrong.headers.get('location')).toBe(SIGN_IN_FAILED_LOCATION);
    expect(setCookieLineOf({ response: wrong, name: PENDING_COOKIE })).toContain('Max-Age=0');
    const replay = await postCodeStep({ code: await validCode({}), pendingToken, csrf });
    expect(replay.headers.get('location')).toBe(SIGN_IN_FAILED_LOCATION);
    expect(cookieValueOf({ response: replay, name: SESSION_COOKIE })).toBeNull();
    expect((await readOperator()).failed_attempts).toBe(1);
  });

  test('a post with no pending cookie is the failure redirect and counts nothing', async () => {
    const { csrf } = await openSignInForm({});
    const response = await postCodeStep({ code: await validCode({}), pendingToken: null, csrf });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe(SIGN_IN_FAILED_LOCATION);
    expect((await readOperator()).failed_attempts).toBe(0);
  });

  test('a rate-limited code step is a 429', async () => {
    const { pendingToken, csrf } = await openPendingSignIn({});
    const env = backofficeEnv({ limiter: createFakeRateLimiter({ limit: 0 }) });
    const response = await postCodeStep({ code: await validCode({}), pendingToken, csrf, env });
    expect(response.status).toBe(STATUS_TOO_MANY_REQUESTS);
  });

  test('a missing code is a 400', async () => {
    const { pendingToken, csrf } = await openPendingSignIn({});
    const response = await requestBackoffice({
      path: CODE_PATH,
      method: 'POST',
      form: { csrf },
      cookies: { [CSRF_COOKIE]: csrf, [PENDING_COOKIE]: pendingToken },
      headers: { Origin: 'http://backoffice.localhost:8787' },
    });
    expect(response.status).toBe(400);
  });
});
