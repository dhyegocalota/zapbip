import { AccountState, HttpStatus } from '@zapbip/types';
import type { Context } from 'hono';
import { SEE_OTHER_STATUS } from '../backoffice/backoffice-constants';
import { textFieldOf } from '../backoffice/form-fields';
import { CSRF_FIELD, ORIGIN_HEADER } from './client-app-constants';
import { ClientAppCopyKey } from './client-app-copy';
import type { ClientAppEnv, ClientAppSession } from './client-app-env';
import { ClientAppPath, pathWithLocale } from './client-app-paths';
import { isCsrfTokenValid } from './csrf';
import { respondMessage } from './respond';

export type SessionHandler = (input: { context: Context<ClientAppEnv>; session: ClientAppSession }) => Response | Promise<Response>;
export type RouteHandler = (context: Context<ClientAppEnv>) => Response | Promise<Response>;

export function isOriginTrusted(input: { context: Context<ClientAppEnv> }): boolean {
  const { context } = input;
  return context.req.header(ORIGIN_HEADER) === new URL(context.env.APP_ORIGIN).origin;
}

export async function isSubmissionTrusted(input: { context: Context<ClientAppEnv>; secret: string }): Promise<boolean> {
  const { context, secret } = input;
  const submittedToken = textFieldOf({ form: await context.req.parseBody(), name: CSRF_FIELD });
  if (!isOriginTrusted({ context }) || submittedToken === null) return false;
  return isCsrfTokenValid({ secret, submittedToken });
}

export function refuseSubmission(input: { context: Context<ClientAppEnv> }): Response | Promise<Response> {
  return respondMessage({
    context: input.context,
    status: HttpStatus.Forbidden,
    title: ClientAppCopyKey.ForbiddenTitle,
    body: ClientAppCopyKey.ForbiddenBody,
  });
}

export function signedIn(handler: SessionHandler): RouteHandler {
  return (context) => {
    const session = context.get('session');
    if (session === null)
      return context.redirect(pathWithLocale({ locale: context.get('locale'), path: ClientAppPath.Home }), SEE_OTHER_STATUS);
    return handler({ context, session });
  };
}

export function trustedSubmission(handler: SessionHandler): RouteHandler {
  return signedIn(async ({ context, session }) => {
    const isTrusted = await isSubmissionTrusted({ context, secret: session.sessionToken });
    if (!isTrusted) return refuseSubmission({ context });
    return handler({ context, session });
  });
}

export function activeSubmission(handler: SessionHandler): RouteHandler {
  return trustedSubmission(({ context, session }) => {
    if (session.state !== AccountState.Active) return refuseSubmission({ context });
    return handler({ context, session });
  });
}
