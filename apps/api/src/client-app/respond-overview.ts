import { HttpStatus } from '@zapbip/types';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { toOverviewWire } from '../accounts/overview-wire';
import { ACCEPT_HEADER, ClientAppJsonError, JSON_CONTENT_TYPE } from './client-app-constants';
import type { ClientAppEnv, ClientAppSession } from './client-app-env';
import { overviewOf } from './respond-home';

export function wantsJson(input: { context: Context<ClientAppEnv> }): boolean {
  const accept = input.context.req.header(ACCEPT_HEADER);
  if (accept === undefined) return false;
  return accept.includes(JSON_CONTENT_TYPE);
}

export async function respondOverview(input: { context: Context<ClientAppEnv>; session: ClientAppSession | null }): Promise<Response> {
  const { context, session } = input;
  if (session === null) return context.json({ error: ClientAppJsonError.SignInRequired }, HttpStatus.Unauthorized as ContentfulStatusCode);
  const overview = await overviewOf({ context, session });
  return context.json(toOverviewWire({ overview }), HttpStatus.Ok as ContentfulStatusCode);
}
