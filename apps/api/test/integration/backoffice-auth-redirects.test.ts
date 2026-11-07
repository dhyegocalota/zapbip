import { beforeEach, describe, expect, test } from 'vitest';
import { csrfTokenOf } from '../../src/backoffice/auth/csrf';
import { BACKOFFICE_ORIGIN, requestBackoffice, resetBackoffice, SESSION_COOKIE, signIn } from './backoffice-auth-fixtures';

const STATUS_SEE_OTHER = 303;
const LOCALE_COOKIE = '__Host-zb_bo_locale';
const ALLOWED_PATHS = ['/numbers', '/metrics', '/audit'];
const HOSTILE_TARGETS = ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/numbers/../x', ''];
const SCRIPT_NOTICE = '<script>alert(1)</script>';

beforeEach(resetBackoffice);

async function switchLocale(input: { returnTo: string; locale?: string }): Promise<Response> {
  const { sessionToken } = await signIn({});
  return requestBackoffice({
    path: '/locale',
    method: 'POST',
    form: {
      csrf: await csrfTokenOf({ sessionToken }),
      locale: input.locale === undefined ? 'en_US' : input.locale,
      returnTo: input.returnTo,
    },
    cookies: { [SESSION_COOKIE]: sessionToken },
    headers: { Origin: BACKOFFICE_ORIGIN },
  });
}

describe('language switch', () => {
  test.each(ALLOWED_PATHS)('returns to the allow-listed path %s', async (path) => {
    const response = await switchLocale({ returnTo: path });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe(path);
  });

  test.each(HOSTILE_TARGETS)('sends the hostile target "%s" home', async (target) => {
    const response = await switchLocale({ returnTo: target });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe('/');
  });

  test('stores the chosen language in a hardened cookie that the pages follow', async () => {
    const response = await switchLocale({ returnTo: '/' });
    const cookie = response.headers.getSetCookie().find((line) => line.startsWith(`${LOCALE_COOKIE}=en_US`));
    ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/'].forEach((attribute) => expect(cookie).toContain(attribute));
    const page = await requestBackoffice({ path: '/sign-in', cookies: { [LOCALE_COOKIE]: 'en_US' } });
    expect(await page.text()).toContain('lang="en"');
  });

  test('an unknown language is not stored', async () => {
    const response = await switchLocale({ returnTo: '/', locale: 'xx_XX' });
    expect(response.headers.getSetCookie().some((line) => line.startsWith(`${LOCALE_COOKIE}=`))).toBe(false);
  });
});

describe('notices', () => {
  test('an allow-listed notice renders its words (pin)', async () => {
    const response = await requestBackoffice({ path: '/sign-in?notice=SignedOut' });
    expect(await response.text()).toContain('Você saiu.');
  });

  test.each([SCRIPT_NOTICE, 'Unknown'])('the notice "%s" renders nothing and reflects nothing (pin)', async (notice) => {
    const response = await requestBackoffice({ path: `/sign-in?notice=${encodeURIComponent(notice)}` });
    const html = await response.text();
    expect(html).not.toContain('class="notice');
    expect(html).not.toContain('alert(1)');
  });
});
