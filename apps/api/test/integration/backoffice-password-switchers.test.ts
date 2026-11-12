import { beforeEach, describe, expect, test } from 'vitest';
import {
  BACKOFFICE_ORIGIN,
  CSRF_COOKIE,
  openPendingSignIn,
  openSignInForm,
  PENDING_COOKIE,
  requestBackoffice,
  resetBackoffice,
} from './backoffice-auth-fixtures';

const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;
const SIGN_IN_PATH = '/sign-in';
const CODE_PATH = '/sign-in/code';
const RETURN_FIELD_PATTERN = /name="returnTo" value="([^"]*)"/g;
const LOCALE_COOKIE = '__Host-zb_bo_locale';

beforeEach(resetBackoffice);

function returnTargetsOf(input: { html: string }): string[] {
  return [...input.html.matchAll(RETURN_FIELD_PATTERN)].map((match) => match[1]!);
}

describe('the switchers on both sign-in pages', () => {
  test('the password page returns to itself from both switchers', async () => {
    const { response } = await openSignInForm({});
    expect(response.status).toBe(STATUS_OK);
    expect(returnTargetsOf({ html: await response.text() })).toEqual([SIGN_IN_PATH, SIGN_IN_PATH]);
  });

  test('the code page returns to itself from both switchers', async () => {
    const { pendingToken } = await openPendingSignIn({});
    const response = await requestBackoffice({ path: CODE_PATH, cookies: { [PENDING_COOKIE]: pendingToken } });
    expect(response.status).toBe(STATUS_OK);
    expect(returnTargetsOf({ html: await response.text() })).toEqual([CODE_PATH, CODE_PATH]);
  });

  test('a language change on the code page returns to it and keeps the pending state', async () => {
    const { pendingToken } = await openPendingSignIn({});
    const page = await requestBackoffice({ path: CODE_PATH, cookies: { [PENDING_COOKIE]: pendingToken } });
    const csrf = page.headers
      .getSetCookie()
      .find((line) => line.startsWith(`${CSRF_COOKIE}=`))!
      .split(';')[0]!
      .split('=')[1]!;
    const response = await requestBackoffice({
      path: '/locale',
      method: 'POST',
      form: { csrf, locale: 'en_US', returnTo: CODE_PATH },
      cookies: { [CSRF_COOKIE]: csrf, [PENDING_COOKIE]: pendingToken },
      headers: { Origin: BACKOFFICE_ORIGIN },
    });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('location')).toBe(CODE_PATH);
    expect(response.headers.getSetCookie().some((line) => line.startsWith(`${LOCALE_COOKIE}=`))).toBe(true);
    const again = await requestBackoffice({ path: CODE_PATH, cookies: { [PENDING_COOKIE]: pendingToken, [LOCALE_COOKIE]: 'en_US' } });
    expect(again.status).toBe(STATUS_OK);
    expect(await again.text()).toContain('lang="en"');
  });
});
