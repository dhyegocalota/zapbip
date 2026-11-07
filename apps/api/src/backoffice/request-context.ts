import { getCookie } from 'hono/cookie';
import type { Context, Next } from 'hono';
import { ACCEPT_LANGUAGE_HEADER, CLIENT_ADDRESS_HEADER, LOCALE_COOKIE_NAME, SESSION_COOKIE_NAME } from './backoffice-constants';
import type { BackofficeEnv } from './backoffice-env';
import { findSession } from './auth/sessions';
import { resolveLocale } from './locale';

export async function requestContext(context: Context<BackofficeEnv>, next: Next): Promise<void> {
  const sessionToken = getCookie(context, SESSION_COOKIE_NAME);
  const session =
    sessionToken === undefined ? null : await findSession({ database: context.env.CONNECTIONS, token: sessionToken, now: Date.now() });
  const clientAddress = context.req.header(CLIENT_ADDRESS_HEADER);
  context.set('session', session);
  context.set('clientAddress', clientAddress === undefined ? null : clientAddress);
  context.set(
    'locale',
    resolveLocale({ cookieValue: getCookie(context, LOCALE_COOKIE_NAME), acceptLanguage: context.req.header(ACCEPT_LANGUAGE_HEADER) }),
  );
  await next();
}
