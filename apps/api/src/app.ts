import { INSTALL_PAGE_PATH_PREFIX } from '@zapbip/types';
import { Hono } from 'hono';
import { HEALTH_PATH } from './contract/constants';
import type { Bindings } from './contract/env';
import { createInstallPageDependencies } from './install/install-page-adapter';
import { parseDeployEnvironment } from './operations/deploy-environment';
import { createInstallPageRoute } from './routes/install-page';
import { connectorRoutes } from './routes/connector';
import { mcpRoutes } from './routes/mcp';
import { mediaRoutes } from './routes/media';
import { uploadRoutes } from './routes/upload';
import { createWhatsappRoutes } from './routes/whatsapp';

export type AppRoutes = Hono<{ Bindings: Bindings }>;

export function createApp(input: {
  extraRoutes: AppRoutes[];
  developmentMediaOrigin: string | null;
  maxFutureSkewMs: number;
}): Hono<{ Bindings: Bindings }> {
  const app = new Hono<{ Bindings: Bindings }>();
  app.get(HEALTH_PATH, (context) => context.json({ ok: true, environment: parseDeployEnvironment({ value: context.env.ENVIRONMENT }) }));
  app.all(`${INSTALL_PAGE_PATH_PREFIX}*`, (context) =>
    createInstallPageRoute(createInstallPageDependencies({ environment: context.env })).fetch(context.req.raw),
  );
  app.route('/', mcpRoutes);
  app.route('/', connectorRoutes);
  app.route('/', uploadRoutes);
  app.route('/', mediaRoutes);
  app.route('/', createWhatsappRoutes({ developmentMediaOrigin: input.developmentMediaOrigin, maxFutureSkewMs: input.maxFutureSkewMs }));
  input.extraRoutes.forEach((routes) => app.route('/', routes));
  return app;
}
