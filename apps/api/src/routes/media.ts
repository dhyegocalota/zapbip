import { Hono } from 'hono';
import type { Bindings } from '../contract/env';

export const mediaRoutes = new Hono<{ Bindings: Bindings }>();
