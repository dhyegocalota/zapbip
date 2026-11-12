import { beforeEach, describe, expect, test } from 'vitest';
import { csrfTokenOf } from '../../src/backoffice/auth/csrf';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_TEST_EMAIL,
  BACKOFFICE_TEST_PASSWORD,
  backofficeEnv,
  postPasswordStep,
  requestBackoffice,
  resetBackoffice,
  SESSION_COOKIE,
  signIn,
} from './backoffice-auth-fixtures';

const STATUS_UNAUTHORIZED = 401;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const STATUS_TOO_MANY_REQUESTS = 429;
const STATUS_SERVICE_UNAVAILABLE = 503;
const MARKER_PATH = '/nope-marker-7731';
const HEADING_PATTERN = /<h1[^>]*>(.*?)<\/h1>/;
const TAG_PATTERN = /<[^>]+>/g;
const ENGLISH = { 'accept-language': 'en-US,en;q=0.9' };

beforeEach(resetBackoffice);

function headingOf(html: string): string {
  return html.match(HEADING_PATTERN)![1]!.replace(TAG_PATTERN, '');
}

describe('error pages', () => {
  test('an unknown path is a 404 page that names the status and does not echo the path', async () => {
    const response = await requestBackoffice({ path: MARKER_PATH, headers: ENGLISH });
    const html = await response.text();
    expect(response.status).toBe(STATUS_NOT_FOUND);
    expect(headingOf(html)).toBe('404 Page not found');
    expect(html).toContain('href="/"');
    expect(html).not.toContain('marker-7731');
  });

  test('the page follows the language of the browser', async () => {
    const html = await (await requestBackoffice({ path: MARKER_PATH })).text();
    expect(headingOf(html)).toBe('404 Página não encontrada');
  });

  test('a refused request is a 403 page', async () => {
    const response = await requestBackoffice({ path: '/sign-in', method: 'POST', form: {}, headers: ENGLISH });
    expect(response.status).toBe(STATUS_FORBIDDEN);
    expect(headingOf(await response.text())).toBe('403 Request refused');
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
    expect(headingOf(await response.text())).toBe('401 Your session ended');
  });

  test('a rate-limited sign-in is a 429 page that keeps Retry-After', async () => {
    const env = backofficeEnv({ limiter: createFakeRateLimiter({ limit: 0 }) });
    const response = await postPasswordStep({ email: BACKOFFICE_TEST_EMAIL, password: BACKOFFICE_TEST_PASSWORD, env });
    expect(response.status).toBe(STATUS_TOO_MANY_REQUESTS);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(await response.text()).toContain('429');
  });

  test('a missing operator secret is a 503 page on every path', async () => {
    const env = backofficeEnv({ overrides: { BACKOFFICE_TOTP_SECRET: '' } });
    const signInPage = await requestBackoffice({ path: '/sign-in', env, headers: ENGLISH });
    expect(signInPage.status).toBe(STATUS_SERVICE_UNAVAILABLE);
    expect(headingOf(await signInPage.text())).toBe('503 The backoffice is not configured');
    const stylesheet = await requestBackoffice({ path: '/assets/backoffice.css', env });
    expect(stylesheet.status).toBe(STATUS_SERVICE_UNAVAILABLE);
  });

  test('a missing password pepper is a 503 page on every path', async () => {
    const env = backofficeEnv({ overrides: { BACKOFFICE_PASSWORD_PEPPER: '' } });
    const signInPage = await requestBackoffice({ path: '/sign-in', env, headers: ENGLISH });
    expect(signInPage.status).toBe(STATUS_SERVICE_UNAVAILABLE);
    expect(headingOf(await signInPage.text())).toBe('503 The backoffice is not configured');
  });

  test.each([
    ['BACKOFFICE_PASSWORD_PEPPER', ' \t\n'],
    ['BACKOFFICE_TOTP_SECRET', '   '],
  ])('a whitespace-only %s is a 503 page', async (name, value) => {
    const env = backofficeEnv({ overrides: { [name]: value } });
    const response = await requestBackoffice({ path: '/sign-in', env, headers: ENGLISH });
    expect(response.status).toBe(STATUS_SERVICE_UNAVAILABLE);
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
