import { HttpStatus } from '@zapbip/types';
import type { Context, Next } from 'hono';
import { DeployEnvironment } from '../contract/deploy-environment';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { errorResponse } from './error-response';
import type { BackofficeEnv } from './backoffice-env';
import { HSTS_MAX_AGE_SECONDS, NO_STORE, NON_ERROR_CODE, STATIC_SECURITY_HEADERS } from './backoffice-constants';

const CACHE_CONTROL_HEADER = 'Cache-Control';
const STRICT_TRANSPORT_SECURITY_HEADER = 'Strict-Transport-Security';
const STRICT_TRANSPORT_SECURITY_VALUE = `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`;

function applySecurityHeaders(input: { response: Response; environment: DeployEnvironment }): void {
  const { response, environment } = input;
  Object.entries(STATIC_SECURITY_HEADERS).forEach(([name, value]) => response.headers.set(name, value));
  if (!response.headers.has(CACHE_CONTROL_HEADER)) response.headers.set(CACHE_CONTROL_HEADER, NO_STORE);
  if (environment !== DeployEnvironment.Development)
    response.headers.set(STRICT_TRANSPORT_SECURITY_HEADER, STRICT_TRANSPORT_SECURITY_VALUE);
}

export async function securityHeaders(context: Context<BackofficeEnv>, next: Next): Promise<void> {
  await next();
  applySecurityHeaders({ response: context.res, environment: context.env.ENVIRONMENT });
}

export async function handleBackofficeError(error: unknown, context: Context<BackofficeEnv>): Promise<Response> {
  logEvent({ event: LogEvent.BackofficeError, errorCode: error instanceof Error ? error.name : NON_ERROR_CODE });
  const response = await errorResponse({ context, status: HttpStatus.InternalServerError });
  applySecurityHeaders({ response, environment: context.env.ENVIRONMENT });
  return response;
}
