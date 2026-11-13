import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE_NAME } from './client-app-constants';
import type { ClientAppEnv } from './client-app-env';
import { localeOfPath } from './client-app-paths';
import { csrfTokenOf } from './csrf';
import { findSession } from './sessions';

export async function clientAppContext(context: Context<ClientAppEnv>, next: Next): Promise<void> {
  context.set('locale', localeOfPath({ path: context.req.path }));
  const sessionToken = getCookie(context, SESSION_COOKIE_NAME);
  const record =
    sessionToken === undefined ? null : await findSession({ database: context.env.CONNECTIONS, token: sessionToken, now: Date.now() });
  context.set('session', record === null ? null : { ...record, csrfToken: await csrfTokenOf({ secret: record.sessionToken }) });
  await next();
}
