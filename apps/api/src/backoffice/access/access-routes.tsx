import { Hono } from 'hono';
import type { BackofficeEnv } from '../backoffice-env';

export const accessRoutes = new Hono<BackofficeEnv>();
