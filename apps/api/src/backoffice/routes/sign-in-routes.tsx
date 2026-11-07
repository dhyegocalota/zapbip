import { HttpStatus, SECOND_MS } from '@zapbip/types';
import { type Context, Hono } from 'hono';
import { setCookie } from 'hono/cookie';
import { encodeBase64Url } from '../../adapters/platform/encoding';
import { BACKOFFICE_SESSION_MAX_MS } from '../../contract/constants';
import { parseDeployEnvironment } from '../../operations/deploy-environment';
import { isWithinRateLimit, RateLimitScope, RETRY_AFTER_SECONDS } from '../auth/rate-limit';
import { attemptSignIn, SignInOutcome } from '../auth/sign-in';
import { STYLESHEET_HREF } from '../assets/stylesheet';
import { CSRF_COOKIE_NAME, CSRF_TOKEN_BYTES, RETRY_AFTER_HEADER, SEE_OTHER_STATUS, SESSION_COOKIE_NAME } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficeNotice, noticeOf } from '../backoffice-notice';
import { BackofficePath } from '../backoffice-paths';
import { errorResponse } from '../error-response';
import { textFieldOf } from '../form-fields';
import { SignInPage } from '../views/sign-in';

const KEY_FIELD = 'key';
const CODE_FIELD = 'code';
const CSRF_FIELD = 'csrf';
const NOTICE_QUERY = 'notice';
const COOKIE_OPTIONS = { secure: true, httpOnly: true, sameSite: 'Strict', path: '/' } as const;

export const signInRoutes = new Hono<BackofficeEnv>();

function pageOf(input: { context: Context<BackofficeEnv>; csrfToken: string }) {
  const { context, csrfToken } = input;
  return (
    <SignInPage
      locale={context.get('locale')}
      environment={parseDeployEnvironment({ value: context.env.ENVIRONMENT })}
      csrfToken={csrfToken}
      stylesheetHref={STYLESHEET_HREF}
      notice={noticeOf({ value: context.req.query(NOTICE_QUERY) })}
    />
  );
}

signInRoutes.get(BackofficePath.SignIn, (context) => {
  if (context.get('session') !== null) return context.redirect(BackofficePath.Home, SEE_OTHER_STATUS);
  const csrfToken = encodeBase64Url({ bytes: crypto.getRandomValues(new Uint8Array(CSRF_TOKEN_BYTES)) });
  setCookie(context, CSRF_COOKIE_NAME, csrfToken, COOKIE_OPTIONS);
  return context.html(pageOf({ context, csrfToken }));
});

signInRoutes.post(BackofficePath.SignIn, async (context) => {
  const clientAddress = context.get('clientAddress');
  if (clientAddress === null) return context.body(null, HttpStatus.BadRequest);
  const isWithinLimit = await isWithinRateLimit({
    limiter: context.env.BACKOFFICE_RATE_LIMITER,
    address: clientAddress,
    scope: RateLimitScope.SignIn,
  });
  if (!isWithinLimit)
    return errorResponse({ context, status: HttpStatus.TooManyRequests, headers: { [RETRY_AFTER_HEADER]: RETRY_AFTER_SECONDS } });
  const form = await context.req.parseBody();
  const key = textFieldOf({ form, name: KEY_FIELD });
  const code = textFieldOf({ form, name: CODE_FIELD });
  const csrfToken = textFieldOf({ form, name: CSRF_FIELD });
  if (key === null || code === null || csrfToken === null) return context.body(null, HttpStatus.BadRequest);
  const result = await attemptSignIn({ env: context.env, key, code, now: Date.now(), clientAddress });
  if (result.outcome === SignInOutcome.Succeeded) {
    setCookie(context, SESSION_COOKIE_NAME, result.sessionToken, {
      ...COOKIE_OPTIONS,
      maxAge: BACKOFFICE_SESSION_MAX_MS / SECOND_MS,
    });
    return context.redirect(BackofficePath.Home, SEE_OTHER_STATUS);
  }
  return context.redirect(`${BackofficePath.SignIn}?${NOTICE_QUERY}=${BackofficeNotice.SignInFailed}`, SEE_OTHER_STATUS);
});
