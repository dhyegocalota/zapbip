import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { MCP_SERVER_VERSION } from '../../contract/constants';
import type { Bindings } from '../../contract/env';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';
import { toolErrorResult, toolSuccessResult } from '../../mcp/tool-error';
import { OPERATOR_MCP_INSTRUCTIONS, OPERATOR_MCP_SERVER_NAME } from './operator-mcp-constants';
import { OperatorToolName } from './operator-tool-name';
import { OperatorToolRefusal } from './operator-tool-refusal';
import { OPERATOR_TOOLS, type OperatorToolContext } from './operator-tools';

async function runTool(input: { name: OperatorToolName; context: OperatorToolContext; toolArguments: unknown }): Promise<CallToolResult> {
  const { name, context, toolArguments } = input;
  logEvent({ event: LogEvent.BackofficeAgentToolCall, kind: name });
  try {
    const structured = await OPERATOR_TOOLS[name].handler({ context, arguments: toolArguments as never });
    return toolSuccessResult({ structured, images: [] });
  } catch (error) {
    if (!(error instanceof OperatorToolRefusal)) throw error;
    return toolErrorResult({ message: error.message });
  }
}

export function createOperatorMcpServer(input: { bindings: Bindings; keyId: string; clientAddress: string | null }): McpServer {
  const { bindings, keyId, clientAddress } = input;
  const context: OperatorToolContext = { bindings, keyId, clientAddress };
  const server = new McpServer(
    { name: OPERATOR_MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    { instructions: OPERATOR_MCP_INSTRUCTIONS },
  );
  Object.values(OperatorToolName).forEach((name) => {
    const { description, inputShape } = OPERATOR_TOOLS[name];
    server.registerTool(name, { description, inputSchema: inputShape }, (toolArguments: unknown) =>
      runTool({ name, context, toolArguments }),
    );
  });
  return server;
}
