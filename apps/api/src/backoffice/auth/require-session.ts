import type { Context, Next } from 'hono';
import type { BackofficeEnv } from '../backoffice-env';

export async function requireSession(_context: Context<BackofficeEnv>, _next: Next): Promise<Response | void> {
  throw new Error('requireSession is not implemented');
}
