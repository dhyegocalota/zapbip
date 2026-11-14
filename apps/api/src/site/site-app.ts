import { HttpStatus, OwnerLocale } from '@zapbip/types';
import type { Context, Next } from 'hono';
import { Hono } from 'hono';
import { FAVICON_CONTENT_TYPE, FAVICON_SVG } from '../backoffice/assets/favicon';
import { SEE_OTHER_STATUS, STYLESHEET_CACHE_CONTROL } from '../backoffice/backoffice-constants';
import { DeployEnvironment } from '../contract/deploy-environment';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import type { EmailSender } from '../emails/email-sender';
import { logEvent } from '../log';
import { plainResponse } from '../routes/private-response';
import { agenticRoutes } from './agentic-routes';
import { joinHandler } from './join-route';
import { languageRedirects } from './language-redirects';
import { markdownNegotiation } from './page-twins';
import { preferenceRoutes } from './preference-routes';
import { LEGAL_PAGES, legalPathOf } from './legal-links';
import { idleJoinOf, renderLanding, renderLegal, renderNotFound } from './render-landing';
import { renderRobots, renderSitemap } from './robots-and-sitemap';
import { siteContext } from './site-context';
import { PAGE_CACHE_CONTROL, PAGE_VARY, SCRIPT_CONTENT_TYPE, STYLESHEET_CONTENT_TYPE, TEXT_CONTENT_TYPE } from './site-constants';
import type { SiteEnv } from './site-env';
import { localePathOf } from './site-language';
import { pagePathOf } from './site-links';
import { SitePath } from './site-paths';
import { SITE_SECURITY_HEADERS, SITE_STRICT_TRANSPORT_SECURITY } from './site-policy';
import { SITE_SCRIPT } from './site-scripts';
import { SITE_STYLESHEET } from './site-stylesheet';

const XML_CONTENT_TYPE = 'application/xml; charset=utf-8';
const SERVER_ERROR_TEXT = 'server error';
const SITE_ERROR_CODE = 'SiteError';

async function securityHeaders(context: Context<SiteEnv>, next: Next): Promise<void> {
  await next();
  Object.entries(SITE_SECURITY_HEADERS).forEach(([name, value]) => context.res.headers.set(name, value));
  if (context.env.ENVIRONMENT === DeployEnvironment.Development) return;
  context.res.headers.set('Strict-Transport-Security', SITE_STRICT_TRANSPORT_SECURITY);
}

export type SiteAppInput = {
  fetchImplementation: typeof fetch;
  emailSenderOf: (input: { env: Bindings }) => EmailSender;
};

export function createSiteApp(input: SiteAppInput): Hono<SiteEnv> {
  const app = new Hono<SiteEnv>();
  app.use('*', securityHeaders);
  app.use('*', siteContext);
  app.use('*', async (context, next) => {
    context.set('emailSender', input.emailSenderOf({ env: context.env }));
    await next();
  });
  app.use('*', languageRedirects);
  app.use('*', markdownNegotiation);
  app.onError((error, context) => {
    logEvent({ event: LogEvent.SiteError, errorCode: error instanceof Error ? error.name : SITE_ERROR_CODE });
    return plainResponse({ body: SERVER_ERROR_TEXT, status: HttpStatus.InternalServerError });
  });
  const landing = (context: Context<SiteEnv>): Response | Promise<Response> =>
    renderLanding({
      context,
      join: idleJoinOf({ context }),
      status: HttpStatus.Ok,
      headers: { 'Cache-Control': PAGE_CACHE_CONTROL, Vary: PAGE_VARY },
    });
  Object.values(OwnerLocale).forEach((locale) => app.get(localePathOf({ locale }), landing));
  LEGAL_PAGES.forEach((page) =>
    app.get(legalPathOf(page), (context) =>
      renderLegal({ context, document: page.document, headers: { 'Cache-Control': PAGE_CACHE_CONTROL, Vary: PAGE_VARY } }),
    ),
  );
  app.post(SitePath.Join, joinHandler({ fetchImplementation: input.fetchImplementation }));
  app.get(SitePath.Join, (context) => {
    const target = pagePathOf({ locale: context.get('locale'), agent: null, referralCode: context.get('referralCode') });
    return context.redirect(target, SEE_OTHER_STATUS);
  });
  app.route('/', preferenceRoutes);
  app.route('/', agenticRoutes);
  app.get(SitePath.Stylesheet, (context) =>
    context.body(SITE_STYLESHEET, HttpStatus.Ok, { 'Content-Type': STYLESHEET_CONTENT_TYPE, 'Cache-Control': STYLESHEET_CACHE_CONTROL }),
  );
  app.get(SitePath.Script, (context) =>
    context.body(SITE_SCRIPT, HttpStatus.Ok, { 'Content-Type': SCRIPT_CONTENT_TYPE, 'Cache-Control': STYLESHEET_CACHE_CONTROL }),
  );
  app.get(SitePath.Robots, (context) =>
    context.body(renderRobots({ origin: context.env.SITE_ORIGIN }), HttpStatus.Ok, { 'Content-Type': TEXT_CONTENT_TYPE }),
  );
  app.get(SitePath.Sitemap, (context) =>
    context.body(renderSitemap({ origin: context.env.SITE_ORIGIN }), HttpStatus.Ok, { 'Content-Type': XML_CONTENT_TYPE }),
  );
  app.get(SitePath.Favicon, (context) =>
    context.body(FAVICON_SVG, HttpStatus.Ok, { 'Content-Type': FAVICON_CONTENT_TYPE, 'Cache-Control': STYLESHEET_CACHE_CONTROL }),
  );
  app.notFound((context) => renderNotFound({ context, status: HttpStatus.NotFound }));
  return app;
}
