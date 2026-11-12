import type { Context, Env } from 'hono';
import { setCookie } from 'hono/cookie';
import { PREFERENCE_COOKIE_MAX_AGE_SECONDS } from './backoffice-constants';

export function setPreferenceCookie<E extends Env>(input: { context: Context<E>; name: string; value: string }): void {
  const { context, name, value } = input;
  setCookie(context, name, value, {
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: PREFERENCE_COOKIE_MAX_AGE_SECONDS,
  });
}
