import { HttpStatus } from '@zapbip/types';
import type { Hono } from 'hono';
import type { Bindings } from '../contract/env';
import { createSiteApp } from '../site/site-app';
import { createBackofficeApp, createRejectedHostApp } from './app';

enum HostKind {
  Backoffice = 'backoffice',
  BackofficeWithTrailingDot = 'backoffice_with_trailing_dot',
  Site = 'site',
  WwwRedirect = 'www_redirect',
  Other = 'other',
}

type HostDispatch = {
  request: Request;
  env: Bindings;
  executionContext: ExecutionContext;
  createMcpApp: () => Hono<{ Bindings: Bindings }>;
};

const WWW_HOST_PREFIX = 'www.';
const TRAILING_DOT_PATTERN = /\.(?=(:[0-9]+)?$)/;

function hostKindOf(input: { url: string; backofficeOrigin: string; siteOrigin: string }): HostKind {
  const requestHost = new URL(input.url).host;
  const backofficeHost = new URL(input.backofficeOrigin).host;
  const siteHost = new URL(input.siteOrigin).host;
  if (requestHost === backofficeHost) return HostKind.Backoffice;
  if (requestHost.replace(TRAILING_DOT_PATTERN, '') === backofficeHost) return HostKind.BackofficeWithTrailingDot;
  if (requestHost === siteHost) return HostKind.Site;
  if (requestHost === `${WWW_HOST_PREFIX}${siteHost}`) return HostKind.WwwRedirect;
  return HostKind.Other;
}

function redirectToSite(input: { request: Request; siteOrigin: string }): Response {
  const { pathname, search } = new URL(input.request.url);
  return Response.redirect(`${new URL(input.siteOrigin).origin}${pathname}${search}`, HttpStatus.MovedPermanently);
}

const HOST_HANDLERS: Record<HostKind, (input: HostDispatch) => Response | Promise<Response>> = {
  [HostKind.Backoffice]: ({ request, env, executionContext }) => createBackofficeApp().fetch(request, env, executionContext),
  [HostKind.BackofficeWithTrailingDot]: ({ request, env, executionContext }) =>
    createRejectedHostApp().fetch(request, env, executionContext),
  [HostKind.Site]: ({ request, env, executionContext }) =>
    createSiteApp({ fetchImplementation: fetch }).fetch(request, env, executionContext),
  [HostKind.WwwRedirect]: ({ request, env }) => redirectToSite({ request, siteOrigin: env.SITE_ORIGIN }),
  [HostKind.Other]: ({ request, env, executionContext, createMcpApp }) => createMcpApp().fetch(request, env, executionContext),
};

export function fetchByHost(input: HostDispatch): Response | Promise<Response> {
  const hostKind = hostKindOf({
    url: input.request.url,
    backofficeOrigin: input.env.BACKOFFICE_ORIGIN,
    siteOrigin: input.env.SITE_ORIGIN,
  });
  return HOST_HANDLERS[hostKind](input);
}
