import { HttpStatus } from '@zapbip/types';
import type { Context, Next } from 'hono';
import { errorResponse } from '../error-response';
import type { BackofficeEnv } from '../backoffice-env';

function isSecretSet(input: { value: string | undefined }): boolean {
  return input.value !== undefined && input.value.trim() !== '';
}

export async function requireConfigured(context: Context<BackofficeEnv>, next: Next): Promise<Response | void> {
  const { BACKOFFICE_TOTP_SECRET, BACKOFFICE_PASSWORD_PEPPER } = context.env;
  const isConfigured = isSecretSet({ value: BACKOFFICE_TOTP_SECRET }) && isSecretSet({ value: BACKOFFICE_PASSWORD_PEPPER });
  if (isConfigured) return next();
  return errorResponse({ context, status: HttpStatus.ServiceUnavailable });
}
