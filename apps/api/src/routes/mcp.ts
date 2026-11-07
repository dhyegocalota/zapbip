import { HttpStatus } from '@zapbip/types';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono, type Context } from 'hono';
import { recordClientName } from '../adapters/d1/d1-client-name-recorder';
import { createPlatformClock } from '../adapters/platform/clock';
import { BATCH_NOT_SUPPORTED_BODY, UNAUTHORIZED_BODY } from '../contract/constants';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { createInstallCodeDirectory } from '../install/install-page-adapter';
import { recordConnectionActivity } from '../mcp/client-name';
import { BEARER_PREFIX, MCP_METHODS } from '../mcp/constants';
import { isJsonRpcBatch, isJsonRpcSuccess } from '../mcp/json-rpc-outcome';
import { resolveConnection, type ResolvedConnection } from './resolve-connection';
import { createConnectionServer } from '../mcp/server';

type McpContext = Context<{ Bindings: Bindings }>;

export const mcpRoutes = new Hono<{ Bindings: Bindings }>();

function readBearerSecret(context: McpContext): string | null {
  const authorization = context.req.header('authorization');
  if (!authorization?.startsWith(BEARER_PREFIX)) return null;
  return authorization.slice(BEARER_PREFIX.length);
}

function recordActivity(input: { context: McpContext; resolved: ResolvedConnection; request: Request }): void {
  const { context, resolved, request } = input;
  const installCodeDirectory = createInstallCodeDirectory({ environment: context.env });
  recordConnectionActivity({
    request,
    connection: resolved.activity,
    recorders: {
      recordFirstCall: (callInput) => installCodeDirectory.recordFirstCall(callInput),
      recordClientName: (nameInput) => recordClientName({ database: context.env.CONNECTIONS, ...nameInput }),
    },
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
  if (await isJsonRpcBatch({ request: context.req.raw })) return context.json(BATCH_NOT_SUPPORTED_BODY, HttpStatus.BadRequest);
  const activityRequest = context.req.raw.clone();
  const server = createConnectionServer({ resolved, environment: context.env });
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  const response = await transport.handleRequest(context.req.raw);
  if (await isJsonRpcSuccess({ response })) recordActivity({ context, resolved, request: activityRequest });
  return response;
}

mcpRoutes.on(MCP_METHODS, '/c/:secret/mcp', (context) => serveMcp({ context, secret: context.req.param('secret') }));
mcpRoutes.on(MCP_METHODS, '/mcp', (context) => serveMcp({ context, secret: readBearerSecret(context) }));
