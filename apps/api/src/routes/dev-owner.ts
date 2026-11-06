import { Hono } from 'hono';
import type { Bindings } from '../contract/env';

export const devOwnerRoutes = new Hono<{ Bindings: Bindings }>();
