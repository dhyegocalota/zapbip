import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { InboxError } from '@zapbip/core';
import { createOutboundGuard } from '../adapters/guard/outbound-guard';
import { mediaStoreOf } from '../adapters/r2/r2-media-store';
import { createPlatformClock } from '../adapters/platform/clock';
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from '../contract/constants';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { McpToolName, TOOL_DEFINITIONS } from '../contract/tool-definitions';
import { logEvent } from '../log';
import { OUTBOUND_TOOLS, TOOL_HANDLERS } from './tool-handlers';
import { assertOutboundAdmitted } from './outbound-admission';
import { toolErrorResult, toolSuccessResult } from './tool-error';
import type { ResolvedConnection } from '../routes/resolve-connection';
import { accountInboxOf } from '../routes/account-inbox-stub';
import type { ToolContext, ToolSuccess } from './types';

type UntypedToolHandler = (input: { context: ToolContext; arguments: unknown }) => Promise<ToolSuccess>;

async function runTool(input: { name: McpToolName; context: ToolContext; toolArguments: unknown }): Promise<CallToolResult> {
  const { connection } = input.context;
  logEvent({ event: LogEvent.ToolCall, accountId: connection.accountId, agent: connection.agent, kind: input.name });
  const handler = TOOL_HANDLERS[input.name] as UntypedToolHandler;
  try {
    if (OUTBOUND_TOOLS.has(input.name)) await assertOutboundAdmitted({ context: input.context });
    return toolSuccessResult(await handler({ context: input.context, arguments: input.toolArguments }));
  } catch (error) {
    if (!(error instanceof InboxError)) throw error;
    logEvent({
      event: LogEvent.ToolError,
      accountId: connection.accountId,
      agent: connection.agent,
      kind: input.name,
      errorCode: error.code,
    });
    return toolErrorResult({ message: error.message });
  }
}

export function createConnectionServer(input: { resolved: ResolvedConnection; environment: Bindings }): McpServer {
  const { resolved, environment } = input;
  const context: ToolContext = {
    connection: resolved.connection,
    origin: environment.PUBLIC_ORIGIN,
    accountInbox: accountInboxOf({ bindings: environment, accountId: resolved.connection.accountId }),
    mediaStore: mediaStoreOf({ bindings: environment, clock: createPlatformClock() }),
    outboundGuard: createOutboundGuard({
      connectionLimiter: environment.OUTBOUND_RATE_LIMITER,
      accountLimiter: environment.ACCOUNT_OUTBOUND_RATE_LIMITER,
    }),
  };
  const server = new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION });
  Object.values(McpToolName).forEach((name) => {
    const definition = TOOL_DEFINITIONS[name];
    server.registerTool(
      name,
      { description: definition.description, inputSchema: definition.inputShape, outputSchema: definition.outputShape },
      (toolArguments: unknown) => runTool({ name, context, toolArguments }),
    );
  });
  return server;
}
