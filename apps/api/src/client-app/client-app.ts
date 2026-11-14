import { HttpStatus, WEB_LOCALE_PATH_PREFIXES, WebLocale } from '@zapbip/types';
import { Hono, type Context, type Next } from 'hono';
import { FAVICON_CONTENT_TYPE, FAVICON_SVG } from '../backoffice/assets/favicon';
import { STYLESHEET_CACHE_CONTROL } from '../backoffice/backoffice-constants';
import { DeployEnvironment } from '../contract/deploy-environment';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { plainResponse, SERVER_ERROR_TEXT } from '../routes/private-response';
import { CLIENT_APP_ERROR_CODE, STYLESHEET_CONTENT_TYPE } from './client-app-constants';
import { ClientAppCopyKey } from './client-app-copy';
import type { ClientAppEnv } from './client-app-env';
import { ClientAppPath, PREFIXED_LOCALES } from './client-app-paths';
import { CLIENT_APP_DEFAULT_CACHE_CONTROL, CLIENT_APP_SECURITY_HEADERS, CLIENT_APP_STRICT_TRANSPORT_SECURITY } from './client-app-policy';
import { CLIENT_APP_STYLESHEET } from './client-app-stylesheet';
import { respondMessage } from './respond';
import { clientAppContext } from './request-context';
import { agentRoutes } from './routes/agent-routes';
import { homeRoutes } from './routes/home-routes';
import { preferenceRoutes } from './routes/preference-routes';
import { sessionRoutes } from './routes/session-routes';
import { signInRoutes } from './routes/sign-in-routes';

async function securityHeaders(context: Context<ClientAppEnv>, next: Next): Promise<void> {
  await next();
  Object.entries(CLIENT_APP_SECURITY_HEADERS).forEach(([name, value]) => context.res.headers.set(name, value));
  if (!context.res.headers.has('Cache-Control')) context.res.headers.set('Cache-Control', CLIENT_APP_DEFAULT_CACHE_CONTROL);
  if (context.env.ENVIRONMENT === DeployEnvironment.Development) return;
  context.res.headers.set('Strict-Transport-Security', CLIENT_APP_STRICT_TRANSPORT_SECURITY);
}

function localizedRoutes(): Hono<ClientAppEnv> {
  const routes = new Hono<ClientAppEnv>();
  routes.route('/', homeRoutes());
  routes.route('/', preferenceRoutes());
  routes.route('/', signInRoutes());
  routes.route('/', sessionRoutes());
  routes.route('/', agentRoutes());
  return routes;
}

export function createClientApp(): Hono<ClientAppEnv> {
  const app = new Hono<ClientAppEnv>();
  app.use('*', securityHeaders);
  app.onError((error, context) => {
    logEvent({ event: LogEvent.ClientAppError, errorCode: error instanceof Error ? error.name : CLIENT_APP_ERROR_CODE });
    return plainResponse({ body: SERVER_ERROR_TEXT, status: HttpStatus.InternalServerError });
  });
  app.get(ClientAppPath.Stylesheet, (context) =>
    context.body(CLIENT_APP_STYLESHEET, HttpStatus.Ok, {
      'Content-Type': STYLESHEET_CONTENT_TYPE,
      'Cache-Control': STYLESHEET_CACHE_CONTROL,
    }),
  );
  app.get(ClientAppPath.Favicon, (context) =>
    context.body(FAVICON_SVG, HttpStatus.Ok, { 'Content-Type': FAVICON_CONTENT_TYPE, 'Cache-Control': STYLESHEET_CACHE_CONTROL }),
  );
  app.use('*', clientAppContext);
  app.route('/', localizedRoutes());
  PREFIXED_LOCALES.forEach((locale) => app.route(WEB_LOCALE_PATH_PREFIXES[locale], localizedRoutes()));
  app.notFound((context) =>
    respondMessage({ context, status: HttpStatus.NotFound, title: ClientAppCopyKey.NotFoundTitle, body: ClientAppCopyKey.NotFoundBody }),
  );
  return app;
}
