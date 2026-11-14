import { getCookie } from 'hono/cookie';
import type { Context, Next } from 'hono';
import { ACCEPT_LANGUAGE_HEADER, LOCALE_COOKIE_NAME, SESSION_COOKIE_NAME, THEME_COOKIE_NAME } from './backoffice-constants';
import type { BackofficeEnv } from './backoffice-env';
import { clientAddressOf } from './client-address';
import { findSession } from './auth/sessions';
import { resolveTheme } from '../web-shell/shell-theme';
import { resolveLocale } from './locale';

export async function requestContext(context: Context<BackofficeEnv>, next: Next): Promise<void> {
  const sessionToken = getCookie(context, SESSION_COOKIE_NAME);
  const session =
    sessionToken === undefined ? null : await findSession({ database: context.env.CONNECTIONS, token: sessionToken, now: Date.now() });
  context.set('session', session);
  context.set('clientAddress', clientAddressOf({ request: context.req.raw }));
  context.set(
    'locale',
    resolveLocale({ cookieValue: getCookie(context, LOCALE_COOKIE_NAME), acceptLanguage: context.req.header(ACCEPT_LANGUAGE_HEADER) }),
  );
  context.set('theme', resolveTheme({ cookieValue: getCookie(context, THEME_COOKIE_NAME) }));
  await next();
}
