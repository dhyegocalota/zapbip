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
import { themeRoutes } from './routes/theme-routes';
import { metricsRoutes } from './metrics/metrics-routes';
import { numbersRoutes } from './numbers/numbers-routes';
import { waitlistRoutes } from './waitlist/waitlist-routes';
import { accessRoutes } from './access/access-routes';
import { agentKeysRoutes } from './operator-mcp/agent-keys-routes';
import { operatorMcpRoutes } from './operator-mcp/operator-mcp-routes';
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
  BackofficePath.Waitlist,
  BackofficePath.WaitlistExport,
  BackofficePath.WaitlistCap,
  BackofficePath.Access,
  BackofficePath.AccessRelease,
  BackofficePath.AccessInvite,
  BackofficePath.AccessInvitesCsv,
  BackofficePath.AgentKeys,
  BackofficePath.AgentKeysRevoke,
];

const FORM_PATHS = [BackofficePath.SignIn, BackofficePath.SignInCode, BackofficePath.Locale, BackofficePath.Theme, ...PROTECTED_PATHS];

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
  app.route('/', operatorMcpRoutes);
  app.use('*', requestContext);
  PROTECTED_PATHS.forEach((path) => app.use(path, requireSession));
  FORM_PATHS.forEach((path) => app.use(path, csrfGuard));
  app.route('/', signInRoutes);
  app.route('/', sessionRoutes);
  app.route('/', localeRoutes);
  app.route('/', themeRoutes);
  app.route('/', auditRoutes);
  app.route('/', metricsRoutes);
  app.route('/', numbersRoutes);
  app.route('/', waitlistRoutes);
  app.route('/', accessRoutes);
  app.route('/', agentKeysRoutes);
  app.notFound((context) => errorResponse({ context, status: HttpStatus.NotFound }));
  return app;
}

export function createRejectedHostApp(): Hono<BackofficeEnv> {
  const app = createBaseApp();
  app.all('*', (context) => errorResponse({ context, status: HttpStatus.NotFound }));
  return app;
}
