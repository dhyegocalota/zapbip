import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { HttpStatus } from '@zapbip/types';
import { Hono } from 'hono';
import { BATCH_NOT_SUPPORTED_BODY, UNAUTHORIZED_BODY } from '../../contract/constants';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';
import { isJsonRpcBatch } from '../../mcp/json-rpc-outcome';
import { RETRY_AFTER_SECONDS } from '../auth/rate-limit';
import { RETRY_AFTER_HEADER } from '../backoffice-constants';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficePath } from '../backoffice-paths';
import { authenticateOperatorKey, bearerKeyOf } from './operator-key-auth';
import { stampOperatorKeyUse } from './operator-key-store';
import {
  OPERATOR_KEY_LAST_USED_INTERVAL_MS,
  OPERATOR_MCP_ALLOW_HEADER,
  OPERATOR_MCP_METHOD,
  OPERATOR_MCP_METHOD_NOT_ALLOWED_BODY,
  OPERATOR_MCP_RATE_LIMITED_BODY,
} from './operator-mcp-constants';
import { createOperatorMcpServer } from './operator-mcp-server';

const AUTHORIZATION_HEADER = 'authorization';

export const operatorMcpRoutes = new Hono<BackofficeEnv>();

operatorMcpRoutes.all(BackofficePath.OperatorMcp, async (context) => {
  if (context.req.method !== OPERATOR_MCP_METHOD)
    return context.json(OPERATOR_MCP_METHOD_NOT_ALLOWED_BODY, HttpStatus.MethodNotAllowed, {
      [OPERATOR_MCP_ALLOW_HEADER]: OPERATOR_MCP_METHOD,
    });
  const { env } = context;
  const now = Date.now();
  const key = bearerKeyOf({ authorization: context.req.header(AUTHORIZATION_HEADER) });
  const keyId = await authenticateOperatorKey({ database: env.CONNECTIONS, key, now });
  if (keyId === null) {
    logEvent({ event: LogEvent.BackofficeAgentKeyRejected });
    return context.json(UNAUTHORIZED_BODY, HttpStatus.Unauthorized);
  }
  const { success: isWithinLimit } = await env.OPERATOR_KEY_RATE_LIMITER.limit({ key: keyId });
  if (!isWithinLimit)
    return context.json(OPERATOR_MCP_RATE_LIMITED_BODY, HttpStatus.TooManyRequests, { [RETRY_AFTER_HEADER]: RETRY_AFTER_SECONDS });
  if (await isJsonRpcBatch({ request: context.req.raw })) return context.json(BATCH_NOT_SUPPORTED_BODY, HttpStatus.BadRequest);
  await stampOperatorKeyUse({ database: env.CONNECTIONS, keyId, now, interval: OPERATOR_KEY_LAST_USED_INTERVAL_MS });
  const server = createOperatorMcpServer({ bindings: env, keyId, clientAddress: context.get('clientAddress') });
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(context.req.raw);
});
