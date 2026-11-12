import { HttpStatus } from '@zapbip/types';
import type { Context, Next } from 'hono';
import { Hono } from 'hono';
import { FAVICON_CONTENT_TYPE, FAVICON_SVG } from '../backoffice/assets/favicon';
import { STYLESHEET_CACHE_CONTROL } from '../backoffice/backoffice-constants';
import { DeployEnvironment } from '../contract/deploy-environment';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { renderRobots, renderSitemap } from './robots-and-sitemap';
import type { SiteEnv } from './site-env';
import { SitePath } from './site-paths';
import { SITE_SECURITY_HEADERS, SITE_STRICT_TRANSPORT_SECURITY } from './site-policy';

const TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';
const XML_CONTENT_TYPE = 'application/xml; charset=utf-8';
const NOT_FOUND_TEXT = 'not found';
const SERVER_ERROR_TEXT = 'server error';
const SITE_ERROR_CODE = 'SiteError';

async function securityHeaders(context: Context<SiteEnv>, next: Next): Promise<void> {
  await next();
  Object.entries(SITE_SECURITY_HEADERS).forEach(([name, value]) => context.res.headers.set(name, value));
  if (context.env.ENVIRONMENT === DeployEnvironment.Development) return;
  context.res.headers.set('Strict-Transport-Security', SITE_STRICT_TRANSPORT_SECURITY);
}

export function createSiteApp(_input: { fetchImplementation: typeof fetch }): Hono<SiteEnv> {
  const app = new Hono<SiteEnv>();
  app.use('*', securityHeaders);
  app.onError((error, context) => {
    logEvent({ event: LogEvent.SiteError, errorCode: error instanceof Error ? error.name : SITE_ERROR_CODE });
    return context.text(SERVER_ERROR_TEXT, HttpStatus.InternalServerError);
  });
  app.get(SitePath.Robots, (context) =>
    context.body(renderRobots({ origin: context.env.SITE_ORIGIN }), HttpStatus.Ok, { 'Content-Type': TEXT_CONTENT_TYPE }),
  );
  app.get(SitePath.Sitemap, (context) =>
    context.body(renderSitemap({ origin: context.env.SITE_ORIGIN }), HttpStatus.Ok, { 'Content-Type': XML_CONTENT_TYPE }),
  );
  app.get(SitePath.Favicon, (context) =>
    context.body(FAVICON_SVG, HttpStatus.Ok, { 'Content-Type': FAVICON_CONTENT_TYPE, 'Cache-Control': STYLESHEET_CACHE_CONTROL }),
  );
  app.notFound((context) => context.text(NOT_FOUND_TEXT, HttpStatus.NotFound));
  return app;
}
