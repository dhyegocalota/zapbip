import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ShapeOutput } from '@modelcontextprotocol/sdk/server/zod-compat.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ZodRawShape } from 'zod';
import { MCP_SERVER_VERSION } from '../../contract/constants';
import type { Bindings } from '../../contract/env';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';
import { toolErrorResult, toolSuccessResult } from '../../mcp/tool-error';
import { OPERATOR_MCP_INSTRUCTIONS, OPERATOR_MCP_SERVER_NAME } from './operator-mcp-constants';
import { OperatorToolName } from './operator-tool-name';
import { OperatorToolRefusal } from './operator-tool-refusal';
import {
  INVITE_WAITLIST_TOOL,
  LIST_AUDIT_TOOL,
  LIST_WAITING_ACCOUNTS_TOOL,
  LIST_WAITLIST_TOOL,
  METRICS_SUMMARY_TOOL,
  RELEASE_ACCESS_TOOL,
  type OperatorToolContext,
  type OperatorToolDefinition,
} from './operator-tools';

async function runTool(input: { name: OperatorToolName; run: () => Promise<Record<string, unknown>> }): Promise<CallToolResult> {
  logEvent({ event: LogEvent.BackofficeAgentToolCall, kind: input.name });
  try {
    return toolSuccessResult({ structured: await input.run(), images: [] });
  } catch (error) {
    if (!(error instanceof OperatorToolRefusal)) throw error;
    return toolErrorResult({ message: error.message });
  }
}

function registerOperatorTool<Shape extends ZodRawShape>(input: {
  server: McpServer;
  context: OperatorToolContext;
  name: OperatorToolName;
  tool: OperatorToolDefinition<Shape>;
}): void {
  const { server, context, name, tool } = input;
  const inputSchema: ZodRawShape = tool.inputShape;
  server.registerTool(name, { description: tool.description, inputSchema }, (toolArguments: unknown) =>
    runTool({ name, run: () => tool.handler({ context, arguments: toolArguments as ShapeOutput<Shape> }) }),
  );
}

export function createOperatorMcpServer(input: { bindings: Bindings; keyId: string; clientAddress: string | null }): McpServer {
  const { bindings, keyId, clientAddress } = input;
  const context: OperatorToolContext = { bindings, keyId, clientAddress };
  const server = new McpServer(
    { name: OPERATOR_MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { instructions: OPERATOR_MCP_INSTRUCTIONS },
  );
  registerOperatorTool({ server, context, name: OperatorToolName.MetricsSummary, tool: METRICS_SUMMARY_TOOL });
  registerOperatorTool({ server, context, name: OperatorToolName.ListWaitlist, tool: LIST_WAITLIST_TOOL });
  registerOperatorTool({ server, context, name: OperatorToolName.ListWaitingAccounts, tool: LIST_WAITING_ACCOUNTS_TOOL });
  registerOperatorTool({ server, context, name: OperatorToolName.ReleaseAccess, tool: RELEASE_ACCESS_TOOL });
  registerOperatorTool({ server, context, name: OperatorToolName.InviteWaitlist, tool: INVITE_WAITLIST_TOOL });
  registerOperatorTool({ server, context, name: OperatorToolName.ListAudit, tool: LIST_AUDIT_TOOL });
  return server;
}
