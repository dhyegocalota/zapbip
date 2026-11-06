import { Hono } from 'hono';
import type { Bindings } from '../contract/env';

export const uploadRoutes = new Hono<{ Bindings: Bindings }>();
