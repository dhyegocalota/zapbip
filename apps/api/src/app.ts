import { Hono } from 'hono';
import { HEALTH_PATH } from './contract/constants';
import type { Bindings } from './contract/env';
import { connectorRoutes } from './routes/connector';
import { mcpRoutes } from './routes/mcp';
import { mediaRoutes } from './routes/media';
import { uploadRoutes } from './routes/upload';
import { createWhatsappRoutes } from './routes/whatsapp';

export type AppRoutes = Hono<{ Bindings: Bindings }>;

export function createApp(input: { extraRoutes: AppRoutes[]; developmentMediaOrigin: string | null }): Hono<{ Bindings: Bindings }> {
  const app = new Hono<{ Bindings: Bindings }>();
  app.get(HEALTH_PATH, (context) => context.json({ ok: true }));
  app.route('/', mcpRoutes);
  app.route('/', connectorRoutes);
  app.route('/', uploadRoutes);
  app.route('/', mediaRoutes);
  app.route('/', createWhatsappRoutes({ developmentMediaOrigin: input.developmentMediaOrigin }));
  input.extraRoutes.forEach((routes) => app.route('/', routes));
  return app;
}
