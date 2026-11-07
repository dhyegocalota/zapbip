import { DAY_MS, HERMES_WHEEL_FILENAME_PATTERN, HERMES_WHEEL_PATH_PREFIX, HttpStatus, InboxErrorCode, SECOND_MS } from '@zapbip/types';
import { type Context, Hono } from 'hono';
import type { Bindings } from '../contract/env';

const FILENAME_PARAMETER = 'filename';
const CACHE_DAYS = 365;
const IMMUTABLE_CACHE_CONTROL = `public, max-age=${(CACHE_DAYS * DAY_MS) / SECOND_MS}, immutable`;
const NO_STORE_CACHE_CONTROL = 'no-store';
const WHEEL_CONTENT_TYPE = 'application/octet-stream';
const UNAVAILABLE_ERROR = 'unavailable';

type PackageContext = Context<{ Bindings: Bindings }>;

function notFound(context: PackageContext): Response {
  return context.json({ error: InboxErrorCode.NotFound }, HttpStatus.NotFound, { 'Cache-Control': NO_STORE_CACHE_CONTROL });
}

export const packageRoutes = new Hono<{ Bindings: Bindings }>();

packageRoutes.get(`${HERMES_WHEEL_PATH_PREFIX}:${FILENAME_PARAMETER}`, async (context) => {
  const filename = context.req.param(FILENAME_PARAMETER);
  if (!HERMES_WHEEL_FILENAME_PATTERN.test(filename)) return notFound(context);
  const wheel = await context.env.PACKAGES.get(filename);
  if (wheel === null) return notFound(context);
  return new Response(wheel.body, {
    status: HttpStatus.Ok,
    headers: {
      'Content-Type': WHEEL_CONTENT_TYPE,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL,
      ETag: wheel.httpEtag,
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

packageRoutes.all(`${HERMES_WHEEL_PATH_PREFIX}*`, notFound);

packageRoutes.onError((_error, context) =>
  context.json({ error: UNAVAILABLE_ERROR }, HttpStatus.ServiceUnavailable, { 'Cache-Control': NO_STORE_CACHE_CONTROL }),
);
