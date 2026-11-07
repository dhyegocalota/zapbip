import { HttpStatus } from '@zapbip/types';
import { Hono } from 'hono';
import type { BackofficeEnv } from './backoffice-env';
import { requireConfigured } from './auth/require-configured';
import { errorResponse } from './error-response';
import { csrfGuard } from './auth/csrf-guard';
import { requireSession } from './auth/require-session';
import { BackofficePath } from './backoffice-paths';
import { sessionRoutes } from './routes/session-routes';
import { assetRoutes } from './routes/asset-routes';
import { auditRoutes } from './routes/audit-routes';
import { localeRoutes } from './routes/locale-routes';
import { numbersRoutes } from './numbers/numbers-routes';
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

const FORM_PATHS = [BackofficePath.SignIn, BackofficePath.Locale, ...PROTECTED_PATHS];

function createBaseApp(): Hono<BackofficeEnv> {
  const app = new Hono<BackofficeEnv>();
  app.use('*', securityHeaders);
  app.onError(handleBackofficeError);
  return app;
}

export function createBackofficeApp(): Hono<BackofficeEnv> {
  const app = createBaseApp();
  app.use('*', requireConfigured);
  app.route('/', assetRoutes);
  app.use('*', requestContext);
  PROTECTED_PATHS.forEach((path) => app.use(path, requireSession));
  FORM_PATHS.forEach((path) => app.use(path, csrfGuard));
  app.route('/', signInRoutes);
  app.route('/', sessionRoutes);
  app.route('/', localeRoutes);
  app.route('/', auditRoutes);
  app.route('/', numbersRoutes);
  app.notFound((context) => errorResponse({ context, status: HttpStatus.NotFound }));
  return app;
}

export function createRejectedHostApp(): Hono<BackofficeEnv> {
  const app = createBaseApp();
  app.all('*', (context) => errorResponse({ context, status: HttpStatus.NotFound }));
  return app;
}
