import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { Hono, type Context } from 'hono';
import { UNAUTHORIZED_BODY } from '../contract/constants';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { BEARER_PREFIX, MCP_METHODS } from '../mcp/constants';
import { resolveConnection } from '../mcp/resolve-connection';
import { createConnectionServer } from '../mcp/server';

type McpContext = Context<{ Bindings: Bindings }>;

export const mcpRoutes = new Hono<{ Bindings: Bindings }>();

function readBearerSecret(context: McpContext): string | null {
  const authorization = context.req.header('authorization');
  if (!authorization?.startsWith(BEARER_PREFIX)) return null;
  return authorization.slice(BEARER_PREFIX.length);
}

async function serveMcp(input: { context: McpContext; secret: string | null }): Promise<Response> {
  const { context, secret } = input;
  const resolved = await resolveConnection({ database: context.env.CONNECTIONS, secret });
  if (!resolved) {
    logEvent({ event: LogEvent.AuthRejected });
    return context.json(UNAUTHORIZED_BODY, 401);
  }
  const server = createConnectionServer({ resolved, environment: context.env });
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(context.req.raw);
}

mcpRoutes.on(MCP_METHODS, '/c/:secret/mcp', (context) => serveMcp({ context, secret: context.req.param('secret') }));
mcpRoutes.on(MCP_METHODS, '/mcp', (context) => serveMcp({ context, secret: readBearerSecret(context) }));
