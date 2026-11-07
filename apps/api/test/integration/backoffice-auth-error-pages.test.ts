import { beforeEach, describe, expect, test } from 'vitest';
import { csrfTokenOf } from '../../src/backoffice/auth/csrf';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_TEST_KEY,
  backofficeEnv,
  postSignIn,
  requestBackoffice,
  resetBackoffice,
  SESSION_COOKIE,
  signIn,
  validCode,
} from './backoffice-auth-fixtures';

const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const STATUS_TOO_MANY_REQUESTS = 429;
const STATUS_SERVICE_UNAVAILABLE = 503;
const MARKER_PATH = '/nope-marker-7731';
const ENGLISH = { 'accept-language': 'en-US,en;q=0.9' };

beforeEach(resetBackoffice);

describe('error pages', () => {
  test('an unknown path is a 404 page that names the status and does not echo the path', async () => {
    const response = await requestBackoffice({ path: MARKER_PATH, headers: ENGLISH });
    const html = await response.text();
    expect(response.status).toBe(STATUS_NOT_FOUND);
    expect(html).toContain('<h1>404 Page not found</h1>');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('marker-7731');
  });

  test('the page follows the language of the browser', async () => {
    const html = await (await requestBackoffice({ path: MARKER_PATH })).text();
    expect(html).toContain('<h1>404 Página não encontrada</h1>');
  });

  test('a refused request is a 403 page', async () => {
    const response = await requestBackoffice({ path: '/sign-in', method: 'POST', form: {}, headers: ENGLISH });
    expect(response.status).toBe(STATUS_FORBIDDEN);
    expect(await response.text()).toContain('<h1>403 Request refused</h1>');
  });

  test('a POST without a session is a 401 page', async () => {
    const { sessionToken } = await signIn({});
    const response = await requestBackoffice({
      path: '/sign-out',
      method: 'POST',
      form: { csrf: await csrfTokenOf({ sessionToken }) },
      headers: { Origin: BACKOFFICE_ORIGIN, ...ENGLISH },
    });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
    expect(await response.text()).toContain('<h1>401 Your session ended</h1>');
  });

  test('a rate-limited sign-in is a 429 page that keeps Retry-After', async () => {
    const env = backofficeEnv({ limiter: createFakeRateLimiter({ limit: 0 }) });
    const response = await postSignIn({ key: BACKOFFICE_TEST_KEY, code: await validCode({}), env });
    expect(response.status).toBe(STATUS_TOO_MANY_REQUESTS);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await response.text()).toContain('429');
  });

  test('a missing operator secret is a 503 page on every path', async () => {
    const env = backofficeEnv({ overrides: { BACKOFFICE_TOTP_SECRET: '' } });
    const signInPage = await requestBackoffice({ path: '/sign-in', env, headers: ENGLISH });
    expect(signInPage.status).toBe(STATUS_SERVICE_UNAVAILABLE);
    expect(await signInPage.text()).toContain('<h1>503 The backoffice is not configured</h1>');
    const stylesheet = await requestBackoffice({ path: '/assets/backoffice.css', env });
    expect(stylesheet.status).toBe(STATUS_SERVICE_UNAVAILABLE);
  });

  test('every error page still carries the security headers', async () => {
    const response = await requestBackoffice({ path: MARKER_PATH });
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  test('a page that needs a session is never reached with a cookie of another session', async () => {
    const response = await requestBackoffice({ path: '/audit', cookies: { [SESSION_COOKIE]: 'not-a-session' } });
    expect(response.status).toBe(303);
  });
});
