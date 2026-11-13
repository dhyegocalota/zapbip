import type { Hono } from 'hono';
import type { Bindings } from '../contract/env';

export function createClientApp(): Hono<{ Bindings: Bindings }> {
  throw new Error('createClientApp is not implemented');
}
