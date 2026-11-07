import { Hono } from 'hono';
import type { Bindings } from '../contract/env';

export const packageRoutes = new Hono<{ Bindings: Bindings }>();
