import type { Hono } from 'hono';
import type { Bindings } from '../contract/env';
import { createBackofficeApp, createRejectedHostApp } from './app';

enum HostKind {
  Backoffice = 'backoffice',
  BackofficeWithTrailingDot = 'backoffice_with_trailing_dot',
  Other = 'other',
}

type HostDispatch = {
  request: Request;
  env: Bindings;
  executionContext: ExecutionContext;
  createMcpApp: () => Hono<{ Bindings: Bindings }>;
};

const TRAILING_DOT_PATTERN = /\.(?=(:[0-9]+)?$)/;

function hostKindOf(input: { url: string; backofficeOrigin: string }): HostKind {
  const requestHost = new URL(input.url).host;
  const backofficeHost = new URL(input.backofficeOrigin).host;
  if (requestHost === backofficeHost) return HostKind.Backoffice;
  if (requestHost.replace(TRAILING_DOT_PATTERN, '') === backofficeHost) return HostKind.BackofficeWithTrailingDot;
  return HostKind.Other;
}

const HOST_HANDLERS: Record<HostKind, (input: HostDispatch) => Response | Promise<Response>> = {
  [HostKind.Backoffice]: ({ request, env, executionContext }) => createBackofficeApp().fetch(request, env, executionContext),
  [HostKind.BackofficeWithTrailingDot]: ({ request, env, executionContext }) =>
    createRejectedHostApp().fetch(request, env, executionContext),
  [HostKind.Other]: ({ request, env, executionContext, createMcpApp }) => createMcpApp().fetch(request, env, executionContext),
};

export function fetchByHost(input: HostDispatch): Response | Promise<Response> {
  const hostKind = hostKindOf({ url: input.request.url, backofficeOrigin: input.env.BACKOFFICE_ORIGIN });
  return HOST_HANDLERS[hostKind](input);
}
