import { HttpStatus } from '@zapbip/types';
import { Hono } from 'hono';
import type { BackofficeEnv } from './backoffice-env';

function notFoundResponse(): Response {
  return new Response(null, { status: HttpStatus.NotFound });
}

export function createBackofficeApp(): Hono<BackofficeEnv> {
  const app = new Hono<BackofficeEnv>();
  app.notFound(notFoundResponse);
  return app;
}

export function createRejectedHostApp(): Hono<BackofficeEnv> {
  const app = new Hono<BackofficeEnv>();
  app.all('*', notFoundResponse);
  return app;
}
