import { HttpStatus } from '@zapbip/types';
import { Hono } from 'hono';
import type { BackofficeEnv } from './backoffice-env';
import { csrfGuard } from './auth/csrf-guard';
import { requireSession } from './auth/require-session';
import { BackofficePath } from './backoffice-paths';
import { sessionRoutes } from './routes/session-routes';
import { requestContext } from './request-context';
import { signInRoutes } from './routes/sign-in-routes';
import { handleBackofficeError, securityHeaders } from './security-headers';

const PROTECTED_PATHS = [
  BackofficePath.Home,
  BackofficePath.SignOut,
  BackofficePath.Numbers,
  `${BackofficePath.Numbers}/*`,
  BackofficePath.Metrics,
  BackofficePath.Audit,
  '/meta-apps/*',
];

function notFoundResponse(): Response {
  return new Response(null, { status: HttpStatus.NotFound });
}

function createBaseApp(): Hono<BackofficeEnv> {
  const app = new Hono<BackofficeEnv>();
  app.use('*', securityHeaders);
  app.onError(handleBackofficeError);
  return app;
}

export function createBackofficeApp(): Hono<BackofficeEnv> {
  const app = createBaseApp();
  app.use('*', requestContext);
  PROTECTED_PATHS.forEach((path) => app.use(path, requireSession));
  app.use('*', csrfGuard);
  app.route('/', signInRoutes);
  app.route('/', sessionRoutes);
  app.notFound(notFoundResponse);
  return app;
}

export function createRejectedHostApp(): Hono<BackofficeEnv> {
  const app = createBaseApp();
  app.all('*', notFoundResponse);
  return app;
}
