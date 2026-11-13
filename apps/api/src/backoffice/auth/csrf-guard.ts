import { HttpStatus } from '@zapbip/types';
import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { errorResponse } from '../error-response';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';
import { CSRF_COOKIE_NAME, SAFE_METHODS } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { textFieldOf } from '../form-fields';
import { constantTimeEqual } from './constant-time';
import { isSessionCsrfTokenValid } from './csrf';

const ORIGIN_HEADER = 'Origin';
const CSRF_FIELD = 'csrf';

async function isSubmittedTokenValid(input: { context: Context<BackofficeEnv>; submittedToken: string | null }): Promise<boolean> {
  const { context, submittedToken } = input;
  if (submittedToken === null) return false;
  const session = context.get('session');
  const cookieToken = getCookie(context, CSRF_COOKIE_NAME);
  const isCookieMatch = cookieToken !== undefined && constantTimeEqual({ left: cookieToken, right: submittedToken });
  const isSessionMatch = session !== null && (await isSessionCsrfTokenValid({ sessionToken: session.token, submittedToken }));
  return isCookieMatch || isSessionMatch;
}

export async function csrfGuard(context: Context<BackofficeEnv>, next: Next): Promise<Response | void> {
  if (SAFE_METHODS.includes(context.req.method)) return next();
  const isOriginValid = context.req.header(ORIGIN_HEADER) === new URL(context.env.BACKOFFICE_ORIGIN).origin;
  const submittedToken = textFieldOf({ form: await context.req.parseBody(), name: CSRF_FIELD });
  const isTokenValid = isOriginValid && (await isSubmittedTokenValid({ context, submittedToken }));
  if (isTokenValid) return next();
  logEvent({ event: LogEvent.BackofficeCsrfRejected });
  return errorResponse({ context, status: HttpStatus.Forbidden });
}
