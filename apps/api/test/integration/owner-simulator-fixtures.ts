import { exports } from 'cloudflare:workers';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpToolName } from '../../src/contract/tool-definitions';
import { callTool, connectClient, openWindow, type ToolResult } from './mcp-fixtures';
import { ORIGIN, seedAccount, type SeededAccount } from './route-fixtures';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const AGENT = 'alpha';

export type OwnerReceipt = { message_id: string | null; agent: string | null; duplicate: boolean };
export type OwnerSession = { account: SeededAccount; client: Client };

export async function startOwnerSession(): Promise<OwnerSession> {
  const account = await seedAccount({ agent: AGENT });
  const client = await connectClient({ secret: account.secret });
  await openWindow({ client, accountId: account.accountId });
  return { account, client };
}

export async function postOwner(input: { session: OwnerSession; body: Record<string, unknown> }): Promise<OwnerReceipt> {
  const response = await exports.default.fetch(
    new Request(`${ORIGIN}/dev/owner/${input.session.account.phone}/messages`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(input.body),
    }),
  );
  if (!response.ok) throw new Error(`owner simulator answered ${response.status}`);
  return (await response.json()) as OwnerReceipt;
}

export function getMessages(input: { session: OwnerSession }): Promise<ToolResult> {
  return callTool({ client: input.session.client, name: McpToolName.GetMessages, arguments: {} });
}
