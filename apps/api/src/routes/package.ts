import {
  DAY_MS,
  HERMES_REQUIREMENTS_FILENAME_PATTERN,
  HERMES_WHEEL_FILENAME_PATTERN,
  HERMES_WHEEL_PATH_PREFIX,
  HttpStatus,
  InboxErrorCode,
  SECOND_MS,
} from '@zapbip/types';
import { type Context, Hono } from 'hono';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';

const FILENAME_PARAMETER = 'filename';
const CACHE_DAYS = 365;
const IMMUTABLE_CACHE_CONTROL = `public, max-age=${(CACHE_DAYS * DAY_MS) / SECOND_MS}, immutable`;
const NO_STORE_CACHE_CONTROL = 'no-store';
const SERVED_PACKAGES = [
  { pattern: HERMES_WHEEL_FILENAME_PATTERN, contentType: 'application/octet-stream' },
  { pattern: HERMES_REQUIREMENTS_FILENAME_PATTERN, contentType: 'text/plain; charset=utf-8' },
];
const UNAVAILABLE_ERROR = 'unavailable';

type PackageContext = Context<{ Bindings: Bindings }>;

function notFound(context: PackageContext): Response {
  return context.json({ error: InboxErrorCode.NotFound }, HttpStatus.NotFound, { 'Cache-Control': NO_STORE_CACHE_CONTROL });
}

export const packageRoutes = new Hono<{ Bindings: Bindings }>();

packageRoutes.get(`${HERMES_WHEEL_PATH_PREFIX}:${FILENAME_PARAMETER}`, async (context) => {
  const filename = context.req.param(FILENAME_PARAMETER);
  const served = SERVED_PACKAGES.find(({ pattern }) => pattern.test(filename));
  if (!served) return notFound(context);
  const wheel = await context.env.PACKAGES.get(filename);
  if (wheel === null) return notFound(context);
  return new Response(wheel.body, {
    status: HttpStatus.Ok,
    headers: {
      'Content-Type': served.contentType,
      'Cache-Control': IMMUTABLE_CACHE_CONTROL,
      ETag: wheel.httpEtag,
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

packageRoutes.all(`${HERMES_WHEEL_PATH_PREFIX}*`, notFound);

packageRoutes.onError((_error, context) => {
  logEvent({ event: LogEvent.PackageUnavailable });
  return context.json({ error: UNAVAILABLE_ERROR }, HttpStatus.ServiceUnavailable, { 'Cache-Control': NO_STORE_CACHE_CONTROL });
});
