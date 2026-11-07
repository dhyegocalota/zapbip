import { HttpStatus } from '@zapbip/types';
import type { Context, Next } from 'hono';
import { errorResponse } from '../error-response';
import type { BackofficeEnv } from '../backoffice-env';

export async function requireConfigured(context: Context<BackofficeEnv>, next: Next): Promise<Response | void> {
  const { BACKOFFICE_KEY_DIGEST, BACKOFFICE_TOTP_SECRET } = context.env;
  if (BACKOFFICE_KEY_DIGEST && BACKOFFICE_TOTP_SECRET) return next();
  return errorResponse({ context, status: HttpStatus.ServiceUnavailable });
}
