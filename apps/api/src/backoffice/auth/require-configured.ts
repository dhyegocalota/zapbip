import { HttpStatus } from '@zapbip/types';
import type { Context, Next } from 'hono';
import { errorResponse } from '../error-response';
import type { BackofficeEnv } from '../backoffice-env';

export async function requireConfigured(context: Context<BackofficeEnv>, next: Next): Promise<Response | void> {
  const { BACKOFFICE_TOTP_SECRET, BACKOFFICE_PASSWORD_PEPPER } = context.env;
  if (BACKOFFICE_TOTP_SECRET && BACKOFFICE_PASSWORD_PEPPER) return next();
  return errorResponse({ context, status: HttpStatus.ServiceUnavailable });
}
