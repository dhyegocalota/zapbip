import { beforeEach, describe, expect, test } from 'vitest';
import { csrfTokenOf } from '../../src/backoffice/auth/csrf';
import {
  BACKOFFICE_ORIGIN,
  CSRF_COOKIE,
  openSignInForm,
  requestBackoffice,
  resetBackoffice,
  SESSION_COOKIE,
  signIn,
} from './backoffice-auth-fixtures';

const STATUS_SEE_OTHER = 303;
const STATUS_FORBIDDEN = 403;
const STATUS_NOT_FOUND = 404;
const THEME_COOKIE = '__Host-zb_bo_theme';
const LOCALE_COOKIE = '__Host-zb_bo_locale';
const ONE_YEAR_SECONDS = '31536000';
const COOKIE_ATTRIBUTES = ['Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/', `Max-Age=${ONE_YEAR_SECONDS}`];
const HOSTILE_TARGETS = [
  'https://evil.example',
  '//evil.example',
  '/\\evil.example',
  'javascript:alert(1)',
  '/numbers/%0d%0a',
  '/numbers/../x',
  '',
];
const EVIL_ORIGIN = 'https://evil.example';

beforeEach(resetBackoffice);

type Preference = { path: '/theme' | '/locale'; field: 'theme' | 'locale'; cookie: string };

const THEME: Preference = { path: '/theme', field: 'theme', cookie: THEME_COOKIE };
const LOCALE: Preference = { path: '/locale', field: 'locale', cookie: LOCALE_COOKIE };

async function signedInPost(input: { preference: Preference; value: string; returnTo: string }): Promise<Response> {
  const { sessionToken } = await signIn({});
  return requestBackoffice({
    path: input.preference.path,
    method: 'POST',
    form: { csrf: await csrfTokenOf({ sessionToken }), [input.preference.field]: input.value, returnTo: input.returnTo },
    cookies: { [SESSION_COOKIE]: sessionToken },
    headers: { Origin: BACKOFFICE_ORIGIN },
  });
}

function cookieLineOf(input: { response: Response; name: string }): string | undefined {
  return input.response.headers.getSetCookie().find((line) => line.startsWith(`${input.name}=`));
}

describe('preference switches', () => {
  test('sets the theme cookie and redirects', async () => {
    const response = await signedInPost({ preference: THEME, value: 'dark', returnTo: '/metrics' });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe('/metrics');
    expect(cookieLineOf({ response, name: THEME_COOKIE })).toContain(`${THEME_COOKIE}=dark`);
  });

  test.each([THEME, LOCALE])('writes the $field cookie with the hardened attributes', async (preference) => {
    const value = preference === THEME ? 'light' : 'en_US';
    const response = await signedInPost({ preference, value, returnTo: '/' });
    const line = cookieLineOf({ response, name: preference.cookie });
    COOKIE_ATTRIBUTES.forEach((attribute) => expect(line).toContain(attribute));
    expect(line).not.toContain('Domain');
  });

  test.each([
    ['theme', THEME, 'purple'],
    ['locale', LOCALE, 'fr'],
  ])('does not store the unknown %s value %s', async (_name, preference, value) => {
    const response = await signedInPost({ preference, value, returnTo: '/' });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(cookieLineOf({ response, name: preference.cookie })).toBeUndefined();
  });

  test.each(HOSTILE_TARGETS)('sends the hostile target "%s" home', async (target) => {
    const response = await signedInPost({ preference: THEME, value: 'dark', returnTo: target });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe('/');
  });

  test('drops the query from the target', async () => {
    const response = await signedInPost({ preference: THEME, value: 'dark', returnTo: '/metrics?period=7d' });
    expect(response.headers.get('location')).toBe('/metrics');
  });

  test('stays on the sign-in page and renders the stored theme when signed out', async () => {
    const { csrf } = await openSignInForm({});
    const response = await requestBackoffice({
      path: '/theme',
      method: 'POST',
      form: { csrf, theme: 'dark', returnTo: '/sign-in' },
      cookies: { [CSRF_COOKIE]: csrf },
      headers: { Origin: BACKOFFICE_ORIGIN },
    });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe('/sign-in');
    const page = await requestBackoffice({ path: '/sign-in', cookies: { [THEME_COOKIE]: 'dark' } });
    expect(await page.text()).toContain('data-theme="dark"');
  });

  test('renders the stored theme and language on a signed-in page', async () => {
    const { sessionToken } = await signIn({});
    const page = await requestBackoffice({
      path: '/',
      cookies: { [SESSION_COOKIE]: sessionToken, [THEME_COOKIE]: 'dark', [LOCALE_COOKIE]: 'en_US' },
    });
    const html = await page.text();
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('lang="en"');
  });

  test('renders the system theme for a hostile cookie value', async () => {
    const page = await requestBackoffice({ path: '/sign-in', cookies: { [THEME_COOKIE]: '"><script>alert(1)</script>' } });
    const html = await page.text();
    expect(html).toContain('data-theme="system"');
    expect(html).not.toContain('alert(1)');
  });

  test.each([
    ['a missing token', { origin: BACKOFFICE_ORIGIN, csrf: null }],
    ['a wrong token', { origin: BACKOFFICE_ORIGIN, csrf: 'wrong' }],
    ['a wrong origin', { origin: EVIL_ORIGIN, csrf: undefined }],
    ['no origin', { origin: null, csrf: undefined }],
  ])('refuses %s with 403 and no cookie', async (_name, { origin, csrf }) => {
    const { sessionToken } = await signIn({});
    const token = csrf === undefined ? await csrfTokenOf({ sessionToken }) : csrf;
    const response = await requestBackoffice({
      path: '/theme',
      method: 'POST',
      form: token === null ? { theme: 'dark' } : { csrf: token, theme: 'dark' },
      cookies: { [SESSION_COOKIE]: sessionToken },
      headers: origin === null ? {} : { Origin: origin },
    });
    expect(response.status).toBe(STATUS_FORBIDDEN);
    expect(cookieLineOf({ response, name: THEME_COOKIE })).toBeUndefined();
  });

  test('a preference never changes on a GET (pin)', async () => {
    const { sessionToken } = await signIn({});
    const response = await requestBackoffice({ path: '/theme?theme=dark', cookies: { [SESSION_COOKIE]: sessionToken } });
    expect(response.status).toBe(STATUS_NOT_FOUND);
    expect(cookieLineOf({ response, name: THEME_COOKIE })).toBeUndefined();
  });
});
