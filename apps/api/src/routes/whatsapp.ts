import { Hono } from 'hono';
import { WHATSAPP_WEBHOOK_PATH } from '../contract/constants';
import type { Bindings } from '../contract/env';

export const whatsappRoutes = new Hono<{ Bindings: Bindings }>();

whatsappRoutes.get(WHATSAPP_WEBHOOK_PATH, () => {
  throw new Error('whatsapp challenge route is not implemented');
});

whatsappRoutes.post(WHATSAPP_WEBHOOK_PATH, () => {
  throw new Error('whatsapp webhook route is not implemented');
});
