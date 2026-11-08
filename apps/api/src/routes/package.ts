import { AGENT_PLUGINS, type AgentPlugin } from '@zapbip/agents/plugins';
import { DAY_MS, HttpStatus, InboxErrorCode, PACKAGE_PATH_PREFIX, SECOND_MS } from '@zapbip/types';
import { type Context, Hono } from 'hono';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';

const FILENAME_PARAMETER = 'filename';
const CACHE_DAYS = 365;
const IMMUTABLE_CACHE_CONTROL = `public, max-age=${(CACHE_DAYS * DAY_MS) / SECOND_MS}, immutable`;
const NO_STORE_CACHE_CONTROL = 'no-store';
function servedPackagesOf(input: { plugins: AgentPlugin[] }): { filename: string; contentType: string }[] {
  return input.plugins
    .flatMap((plugin) => plugin.hostedArtifacts)
    .map((artifact) => ({ filename: artifact.filename, contentType: artifact.contentType }));
}

export const SERVED_PACKAGES = servedPackagesOf({ plugins: Object.values(AGENT_PLUGINS) });
const UNAVAILABLE_ERROR = 'unavailable';

type PackageContext = Context<{ Bindings: Bindings }>;

function notFound(context: PackageContext): Response {
  return context.json({ error: InboxErrorCode.NotFound }, HttpStatus.NotFound, { 'Cache-Control': NO_STORE_CACHE_CONTROL });
}

export function packageRoutesFor(input: { plugins: AgentPlugin[] }): Hono<{ Bindings: Bindings }> {
  const servedPackages = servedPackagesOf({ plugins: input.plugins });
  const routes = new Hono<{ Bindings: Bindings }>();

  routes.get(`${PACKAGE_PATH_PREFIX}:${FILENAME_PARAMETER}`, async (context) => {
    const filename = context.req.param(FILENAME_PARAMETER);
    const served = servedPackages.find((candidate) => candidate.filename === filename);
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

  routes.all(`${PACKAGE_PATH_PREFIX}*`, notFound);

  routes.onError((_error, context) => {
    logEvent({ event: LogEvent.PackageUnavailable });
    return context.json({ error: UNAVAILABLE_ERROR }, HttpStatus.ServiceUnavailable, { 'Cache-Control': NO_STORE_CACHE_CONTROL });
  });

  return routes;
}

export const packageRoutes = packageRoutesFor({ plugins: Object.values(AGENT_PLUGINS) });
