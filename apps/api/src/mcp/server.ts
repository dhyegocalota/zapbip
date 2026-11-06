import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConnectionIdentity } from '@zapbip/core';
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from '../contract/constants';
import type { Bindings } from '../contract/env';

export function createConnectionServer(input: { connection: ConnectionIdentity; environment: Bindings }): McpServer {
  void input;
  return new McpServer({ name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION });
}
