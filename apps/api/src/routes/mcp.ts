import { Hono } from 'hono';
import type { Bindings } from '../contract/env';

export const mcpRoutes = new Hono<{ Bindings: Bindings }>();
