import { HttpStatus } from '@zapbip/types';
import { Hono } from 'hono';
import { EMBEDDED_SIGNUP_SCRIPT } from '../assets/embedded-signup';
import { FAVICON_CONTENT_TYPE, FAVICON_SVG } from '../assets/favicon';
import { BACKOFFICE_STYLESHEET } from '../assets/stylesheet';
import { STYLESHEET_CACHE_CONTROL } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficePath } from '../backoffice-paths';

const STYLESHEET_CONTENT_TYPE = 'text/css; charset=utf-8';
const SCRIPT_CONTENT_TYPE = 'text/javascript; charset=utf-8';

export const assetRoutes = new Hono<BackofficeEnv>();

assetRoutes.get(
  BackofficePath.Stylesheet,
  () =>
    new Response(BACKOFFICE_STYLESHEET, {
      headers: { 'Content-Type': STYLESHEET_CONTENT_TYPE, 'Cache-Control': STYLESHEET_CACHE_CONTROL },
    }),
);
assetRoutes.all(BackofficePath.Stylesheet, () => new Response(null, { status: HttpStatus.NotFound }));

assetRoutes.get(
  BackofficePath.EmbeddedSignupScript,
  () =>
    new Response(EMBEDDED_SIGNUP_SCRIPT, {
      headers: { 'Content-Type': SCRIPT_CONTENT_TYPE, 'Cache-Control': STYLESHEET_CACHE_CONTROL },
    }),
);
assetRoutes.all(BackofficePath.EmbeddedSignupScript, () => new Response(null, { status: HttpStatus.NotFound }));

[BackofficePath.Favicon, BackofficePath.LegacyFavicon].forEach((path) => {
  assetRoutes.get(
    path,
    () => new Response(FAVICON_SVG, { headers: { 'Content-Type': FAVICON_CONTENT_TYPE, 'Cache-Control': STYLESHEET_CACHE_CONTROL } }),
  );
  assetRoutes.all(path, () => new Response(null, { status: HttpStatus.NotFound }));
});
