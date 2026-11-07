import { HttpStatus } from '@zapbip/types';
import { Hono } from 'hono';
import { BACKOFFICE_STYLESHEET } from '../assets/stylesheet';
import { STYLESHEET_CACHE_CONTROL } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficePath } from '../backoffice-paths';

const STYLESHEET_CONTENT_TYPE = 'text/css; charset=utf-8';

export const assetRoutes = new Hono<BackofficeEnv>();

assetRoutes.get(
  BackofficePath.Stylesheet,
  () =>
    new Response(BACKOFFICE_STYLESHEET, {
      headers: { 'Content-Type': STYLESHEET_CONTENT_TYPE, 'Cache-Control': STYLESHEET_CACHE_CONTROL },
    }),
);
assetRoutes.all(BackofficePath.Stylesheet, () => new Response(null, { status: HttpStatus.NotFound }));
