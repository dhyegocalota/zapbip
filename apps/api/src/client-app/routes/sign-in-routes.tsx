import { CLIENT_ADDRESS_HEADER } from '../../contract/constants';
import { HttpStatus } from '@zapbip/types';
import { Hono, type Context } from 'hono';
import { setCookie } from 'hono/cookie';
import { SEE_OTHER_STATUS } from '../../backoffice/backoffice-constants';
import { clientRateKey } from '../../routes/client-rate-key';
import { BAD_REQUEST_TEXT, plainResponse, RATE_LIMIT_RETRY_AFTER_SECONDS, RETRY_AFTER_HEADER } from '../../routes/private-response';
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SIGN_IN_RATE_KEY_PREFIX,
  SIGN_IN_TOKEN_PATTERN,
} from '../client-app-constants';
import { ClientAppCopyKey } from '../client-app-copy';
import type { ClientAppEnv } from '../client-app-env';
import { ClientAppPath, pathWithLocale } from '../client-app-paths';
import { csrfTokenOf } from '../csrf';
import { respondMessage } from '../respond';
import { isSubmissionTrusted, refuseSubmission } from '../session-guards';
import { createSession, findSession } from '../sessions';
import { consumeSignInToken, isSignInTokenOpen } from '../sign-in-tokens';
import { ContinuePage } from '../views/continue-page';

const TOKEN_ROUTE = `${ClientAppPath.SignIn}/:token`;

function tokenOf(input: { context: Context<ClientAppEnv> }): string {
  const token = input.context.req.param('token');
  if (token === undefined) throw new Error('the sign-in route has no token');
  return token;
}

function respondExpired(input: { context: Context<ClientAppEnv> }): Response | Promise<Response> {
  return respondMessage({
    context: input.context,
    status: HttpStatus.Gone,
    title: ClientAppCopyKey.ExpiredTitle,
    body: ClientAppCopyKey.ExpiredBody,
  });
}

function respondRateLimited(input: { context: Context<ClientAppEnv> }): Response | Promise<Response> {
  return respondMessage({
    context: input.context,
    status: HttpStatus.TooManyRequests,
    title: ClientAppCopyKey.RateLimitedTitle,
    body: ClientAppCopyKey.RateLimitedBody,
    headers: { [RETRY_AFTER_HEADER]: String(RATE_LIMIT_RETRY_AFTER_SECONDS) },
  });
}

async function showContinue(context: Context<ClientAppEnv>): Promise<Response> {
  const token = tokenOf({ context });
  const isOpen =
    SIGN_IN_TOKEN_PATTERN.test(token) && (await isSignInTokenOpen({ database: context.env.CONNECTIONS, token, now: Date.now() }));
  if (!isOpen) return respondExpired({ context });
  const page = <ContinuePage locale={context.get('locale')} token={token} csrfToken={await csrfTokenOf({ secret: token })} />;
  return context.html(page);
}

async function signInWithToken(context: Context<ClientAppEnv>): Promise<Response> {
  const clientAddress = context.req.header(CLIENT_ADDRESS_HEADER);
  if (clientAddress === undefined) return plainResponse({ body: BAD_REQUEST_TEXT, status: HttpStatus.BadRequest });
  const { success: isWithinLimit } = await context.env.INSTALL_PAGE_LIMITER.limit({
    key: `${SIGN_IN_RATE_KEY_PREFIX}${clientRateKey({ address: clientAddress })}`,
  });
  if (!isWithinLimit) return respondRateLimited({ context });
  const token = tokenOf({ context });
  const isTrusted = await isSubmissionTrusted({ context, secret: token });
  if (!isTrusted) return refuseSubmission({ context });
  const { CONNECTIONS: database } = context.env;
  const accountId = SIGN_IN_TOKEN_PATTERN.test(token) ? await consumeSignInToken({ database, token, now: Date.now() }) : null;
  if (accountId === null) return respondExpired({ context });
  const sessionToken = await createSession({ database, accountId, now: Date.now() });
  const session = await findSession({ database, token: sessionToken, now: Date.now() });
  if (session === null) return respondExpired({ context });
  setCookie(context, SESSION_COOKIE_NAME, sessionToken, {
    secure: true,
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  return context.redirect(pathWithLocale({ locale: session.locale, path: ClientAppPath.Home }), SEE_OTHER_STATUS);
}

export function signInRoutes(): Hono<ClientAppEnv> {
  const routes = new Hono<ClientAppEnv>();
  routes.get(TOKEN_ROUTE, showContinue);
  routes.post(TOKEN_ROUTE, signInWithToken);
  return routes;
}
