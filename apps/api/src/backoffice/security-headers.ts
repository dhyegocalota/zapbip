import { HttpStatus } from '@zapbip/types';
import type { Context, Next } from 'hono';
import { DeployEnvironment } from '../contract/deploy-environment';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { errorResponse } from './error-response';
import type { BackofficeEnv } from './backoffice-env';
import {
  CACHE_CONTROL_HEADER,
  HSTS_MAX_AGE_SECONDS,
  NO_STORE,
  NON_ERROR_CODE,
  PAGE_POLICY_HEADERS,
  PagePolicy,
} from './backoffice-constants';

const STRICT_TRANSPORT_SECURITY_HEADER = 'Strict-Transport-Security';
const STRICT_TRANSPORT_SECURITY_VALUE = `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`;

function applySecurityHeaders(input: { response: Response; environment: DeployEnvironment; policy: PagePolicy }): void {
  const { response, environment, policy } = input;
  Object.entries(PAGE_POLICY_HEADERS[policy]).forEach(([name, value]) => response.headers.set(name, value));
  if (!response.headers.has(CACHE_CONTROL_HEADER)) response.headers.set(CACHE_CONTROL_HEADER, NO_STORE);
  if (environment !== DeployEnvironment.Development)
    response.headers.set(STRICT_TRANSPORT_SECURITY_HEADER, STRICT_TRANSPORT_SECURITY_VALUE);
}

export async function securityHeaders(context: Context<BackofficeEnv>, next: Next): Promise<void> {
  context.set('pagePolicy', PagePolicy.Strict);
  await next();
  applySecurityHeaders({ response: context.res, environment: context.env.ENVIRONMENT, policy: context.get('pagePolicy') });
}

export async function handleBackofficeError(error: unknown, context: Context<BackofficeEnv>): Promise<Response> {
  logEvent({ event: LogEvent.BackofficeError, errorCode: error instanceof Error ? error.name : NON_ERROR_CODE });
  context.set('pagePolicy', PagePolicy.Strict);
  const response = await errorResponse({ context, status: HttpStatus.InternalServerError });
  applySecurityHeaders({ response, environment: context.env.ENVIRONMENT, policy: PagePolicy.Strict });
  return response;
}
