import { HttpStatus } from '@zapbip/types';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono, type Context } from 'hono';
import { createPlatformClock } from '../adapters/platform/clock';
import { UNAUTHORIZED_BODY } from '../contract/constants';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { createInstallCodeDirectory } from '../install/install-page-adapter';
import { createConnectionRecorders, recordConnectionActivity } from '../mcp/client-name';
import { BEARER_PREFIX, MCP_METHODS } from '../mcp/constants';
import { resolveConnection, type ResolvedConnection } from './resolve-connection';
import { createConnectionServer } from '../mcp/server';

type McpContext = Context<{ Bindings: Bindings }>;

export const mcpRoutes = new Hono<{ Bindings: Bindings }>();

function readBearerSecret(context: McpContext): string | null {
  const authorization = context.req.header('authorization');
  if (!authorization?.startsWith(BEARER_PREFIX)) return null;
  return authorization.slice(BEARER_PREFIX.length);
}

function recordActivity(input: { context: McpContext; resolved: ResolvedConnection }): void {
  const { context, resolved } = input;
  const installCodeDirectory = createInstallCodeDirectory({ environment: context.env });
  recordConnectionActivity({
    request: context.req.raw,
    connection: resolved.activity,
    recorders: createConnectionRecorders({
      database: context.env.CONNECTIONS,
      recordFirstCall: (callInput) => installCodeDirectory.recordFirstCall(callInput),
    }),
    calledAt: createPlatformClock().now(),
    schedule: (work) => context.executionCtx.waitUntil(work),
  });
}

async function serveMcp(input: { context: McpContext; secret: string | null }): Promise<Response> {
  const { context, secret } = input;
  const resolved = await resolveConnection({ database: context.env.CONNECTIONS, secret });
  if (!resolved) {
    logEvent({ event: LogEvent.AuthRejected });
    return context.json(UNAUTHORIZED_BODY, HttpStatus.Unauthorized);
  }
  recordActivity({ context, resolved });
  const server = createConnectionServer({ resolved, environment: context.env });
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(context.req.raw);
}

mcpRoutes.on(MCP_METHODS, '/c/:secret/mcp', (context) => serveMcp({ context, secret: context.req.param('secret') }));
mcpRoutes.on(MCP_METHODS, '/mcp', (context) => serveMcp({ context, secret: readBearerSecret(context) }));
