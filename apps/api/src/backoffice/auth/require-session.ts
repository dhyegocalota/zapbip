import { HttpStatus } from '@zapbip/types';
import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { SEE_OTHER_STATUS, SESSION_COOKIE_NAME } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficeNotice } from '../backoffice-notice';
import { BackofficePath } from '../backoffice-paths';

const PAGE_METHOD = 'GET';
const NOTICE_QUERY = 'notice';

export async function requireSession(context: Context<BackofficeEnv>, next: Next): Promise<Response | void> {
  if (context.get('session') !== null) return next();
  if (context.req.method !== PAGE_METHOD) return context.body(null, HttpStatus.Unauthorized);
  const hadSession = getCookie(context, SESSION_COOKIE_NAME) !== undefined;
  const target = hadSession ? `${BackofficePath.SignIn}?${NOTICE_QUERY}=${BackofficeNotice.SessionEnded}` : BackofficePath.SignIn;
  return context.redirect(target, SEE_OTHER_STATUS);
}
