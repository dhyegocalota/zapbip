import type { Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { PREFERENCE_COOKIE_MAX_AGE_SECONDS } from './backoffice-constants';
import type { BackofficeEnv } from './backoffice-env';

export function setPreferenceCookie(input: { context: Context<BackofficeEnv>; name: string; value: string }): void {
  const { context, name, value } = input;
  setCookie(context, name, value, {
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: PREFERENCE_COOKIE_MAX_AGE_SECONDS,
  });
}
