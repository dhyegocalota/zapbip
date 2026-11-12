import { HttpStatus, SECOND_MS } from '@zapbip/types';
import { type Context, Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { encodeBase64Url } from '../../adapters/platform/encoding';
import { BACKOFFICE_PENDING_SIGN_IN_MS, BACKOFFICE_SESSION_MAX_MS } from '../../contract/constants';
import { parseDeployEnvironment } from '../../operations/deploy-environment';
import { isPendingSignInLive } from '../auth/pending-sign-in';
import { isWithinRateLimit, RateLimitScope, RETRY_AFTER_SECONDS } from '../auth/rate-limit';
import { attemptCodeSignIn, attemptPasswordSignIn, PasswordSignInOutcome, SignInOutcome } from '../auth/sign-in';
import { STYLESHEET_HREF } from '../assets/stylesheet';
import {
  CSRF_COOKIE_NAME,
  CSRF_TOKEN_BYTES,
  PENDING_SIGN_IN_COOKIE_NAME,
  RETRY_AFTER_HEADER,
  SEE_OTHER_STATUS,
  SESSION_COOKIE_NAME,
} from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficeNotice, noticeOf } from '../backoffice-notice';
import { BackofficePath } from '../backoffice-paths';
import { errorResponse } from '../error-response';
import { textFieldOf } from '../form-fields';
import { SignInPage, type SignInPageProps } from '../views/sign-in';
import { SignInCodePage } from '../views/sign-in-code';

const EMAIL_FIELD = 'email';
const PASSWORD_FIELD = 'password';
const CODE_FIELD = 'code';
const CSRF_FIELD = 'csrf';
const NOTICE_QUERY = 'notice';
const COOKIE_OPTIONS = { secure: true, httpOnly: true, sameSite: 'Strict', path: '/' } as const;
const PENDING_COOKIE_OPTIONS = { ...COOKIE_OPTIONS, maxAge: BACKOFFICE_PENDING_SIGN_IN_MS / SECOND_MS } as const;
const CLEARED_COOKIE_OPTIONS = { secure: true, path: '/' } as const;

export const signInRoutes = new Hono<BackofficeEnv>();

function pagePropsOf(input: { context: Context<BackofficeEnv>; csrfToken: string }): SignInPageProps {
  const { context, csrfToken } = input;
  return {
    locale: context.get('locale'),
    theme: context.get('theme'),
    environment: parseDeployEnvironment({ value: context.env.ENVIRONMENT }),
    csrfToken,
    stylesheetHref: STYLESHEET_HREF,
    notice: noticeOf({ value: context.req.query(NOTICE_QUERY) }),
  };
}

function issueCsrfToken(input: { context: Context<BackofficeEnv> }): string {
  const csrfToken = encodeBase64Url({ bytes: crypto.getRandomValues(new Uint8Array(CSRF_TOKEN_BYTES)) });
  setCookie(input.context, CSRF_COOKIE_NAME, csrfToken, COOKIE_OPTIONS);
  return csrfToken;
}

function failedRedirectOf(input: { context: Context<BackofficeEnv> }): Response {
  return input.context.redirect(`${BackofficePath.SignIn}?${NOTICE_QUERY}=${BackofficeNotice.SignInFailed}`, SEE_OTHER_STATUS);
}

async function isWithinSignInLimit(input: { context: Context<BackofficeEnv>; clientAddress: string }): Promise<boolean> {
  return isWithinRateLimit({
    limiter: input.context.env.BACKOFFICE_RATE_LIMITER,
    address: input.clientAddress,
    scope: RateLimitScope.SignIn,
  });
}

function tooManyAttemptsResponseOf(input: { context: Context<BackofficeEnv> }): Response | Promise<Response> {
  return errorResponse({
    context: input.context,
    status: HttpStatus.TooManyRequests,
    headers: { [RETRY_AFTER_HEADER]: RETRY_AFTER_SECONDS },
  });
}

signInRoutes.get(BackofficePath.SignIn, (context) => {
  if (context.get('session') !== null) return context.redirect(BackofficePath.Home, SEE_OTHER_STATUS);
  const csrfToken = issueCsrfToken({ context });
  return context.html(<SignInPage {...pagePropsOf({ context, csrfToken })} />);
});

signInRoutes.post(BackofficePath.SignIn, async (context) => {
  const clientAddress = context.get('clientAddress');
  if (clientAddress === null) return context.body(null, HttpStatus.BadRequest);
  if (!(await isWithinSignInLimit({ context, clientAddress }))) return tooManyAttemptsResponseOf({ context });
  const form = await context.req.parseBody();
  const email = textFieldOf({ form, name: EMAIL_FIELD });
  const password = textFieldOf({ form, name: PASSWORD_FIELD });
  const csrfToken = textFieldOf({ form, name: CSRF_FIELD });
  if (email === null || password === null || csrfToken === null) return context.body(null, HttpStatus.BadRequest);
  const result = await attemptPasswordSignIn({ env: context.env, email, password, now: Date.now(), clientAddress });
  if (result.outcome === PasswordSignInOutcome.Failed) return failedRedirectOf({ context });
  setCookie(context, PENDING_SIGN_IN_COOKIE_NAME, result.pendingToken, PENDING_COOKIE_OPTIONS);
  return context.redirect(BackofficePath.SignInCode, SEE_OTHER_STATUS);
});

signInRoutes.get(BackofficePath.SignInCode, async (context) => {
  if (context.get('session') !== null) return context.redirect(BackofficePath.Home, SEE_OTHER_STATUS);
  const pendingToken = getCookie(context, PENDING_SIGN_IN_COOKIE_NAME);
  if (pendingToken === undefined) return context.redirect(BackofficePath.SignIn, SEE_OTHER_STATUS);
  const isPendingLive = await isPendingSignInLive({ database: context.env.CONNECTIONS, token: pendingToken, now: Date.now() });
  if (!isPendingLive) return context.redirect(BackofficePath.SignIn, SEE_OTHER_STATUS);
  const csrfToken = issueCsrfToken({ context });
  return context.html(<SignInCodePage {...pagePropsOf({ context, csrfToken })} />);
});

signInRoutes.post(BackofficePath.SignInCode, async (context) => {
  const clientAddress = context.get('clientAddress');
  if (clientAddress === null) return context.body(null, HttpStatus.BadRequest);
  if (!(await isWithinSignInLimit({ context, clientAddress }))) return tooManyAttemptsResponseOf({ context });
  const form = await context.req.parseBody();
  const code = textFieldOf({ form, name: CODE_FIELD });
  const csrfToken = textFieldOf({ form, name: CSRF_FIELD });
  if (code === null || csrfToken === null) return context.body(null, HttpStatus.BadRequest);
  const pendingToken = getCookie(context, PENDING_SIGN_IN_COOKIE_NAME);
  deleteCookie(context, PENDING_SIGN_IN_COOKIE_NAME, CLEARED_COOKIE_OPTIONS);
  if (pendingToken === undefined) return failedRedirectOf({ context });
  const result = await attemptCodeSignIn({ env: context.env, pendingToken, code, now: Date.now(), clientAddress });
  if (result.outcome === SignInOutcome.Failed) return failedRedirectOf({ context });
  setCookie(context, SESSION_COOKIE_NAME, result.sessionToken, { ...COOKIE_OPTIONS, maxAge: BACKOFFICE_SESSION_MAX_MS / SECOND_MS });
  return context.redirect(BackofficePath.Home, SEE_OTHER_STATUS);
});
