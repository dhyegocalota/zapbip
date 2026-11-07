import type { Context, Next } from 'hono';
import type { BackofficeEnv } from './backoffice-env';

export async function securityHeaders(_context: Context<BackofficeEnv>, _next: Next): Promise<void> {
  throw new Error('securityHeaders is not implemented');
}

export function handleBackofficeError(_error: unknown, _context: Context<BackofficeEnv>): Response {
  throw new Error('handleBackofficeError is not implemented');
}
