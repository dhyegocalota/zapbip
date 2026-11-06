import { Hono } from 'hono';
import { HEALTH_PATH } from './contract/constants';
import type { Bindings } from './contract/env';
import { mcpRoutes } from './routes/mcp';
import { mediaRoutes } from './routes/media';
import { uploadRoutes } from './routes/upload';
import { whatsappRoutes } from './routes/whatsapp';

export type AppRoutes = Hono<{ Bindings: Bindings }>;

export function createApp(input: { extraRoutes: AppRoutes[] }): Hono<{ Bindings: Bindings }> {
  const app = new Hono<{ Bindings: Bindings }>();
  app.get(HEALTH_PATH, (context) => context.json({ ok: true }));
  app.route('/', mcpRoutes);
  app.route('/', uploadRoutes);
  app.route('/', mediaRoutes);
  app.route('/', whatsappRoutes);
  input.extraRoutes.forEach((routes) => app.route('/', routes));
  return app;
}
