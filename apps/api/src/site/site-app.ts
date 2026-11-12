import { Hono } from 'hono';
import type { SiteEnv } from './site-env';

export function createSiteApp(input: { fetchImplementation: typeof fetch }): Hono<SiteEnv> {
  throw new Error(`createSiteApp is not implemented ${String(input.fetchImplementation)}`);
}
