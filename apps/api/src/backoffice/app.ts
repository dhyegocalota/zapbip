import { HttpStatus } from '@zapbip/types';
import { Hono } from 'hono';
import type { BackofficeEnv } from './backoffice-env';
import { requestContext } from './request-context';
import { signInRoutes } from './routes/sign-in-routes';
import { handleBackofficeError, securityHeaders } from './security-headers';

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
  app.route('/', signInRoutes);
  app.notFound(notFoundResponse);
  return app;
}

export function createRejectedHostApp(): Hono<BackofficeEnv> {
  const app = createBaseApp();
  app.all('*', notFoundResponse);
  return app;
}
