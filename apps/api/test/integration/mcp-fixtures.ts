import { env, exports } from 'cloudflare:workers';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { OwnerInboundContent } from '@zapbip/core';
import { MessageKind, OwnerLocale } from '@zapbip/types';
import type { DevAccountInboxRpc } from '../../src/contract/account-inbox-rpc';
import { generateConnectionSecret } from '../../src/adapters/platform/connection-secret';
import { hashConnectionSecret } from '../../src/adapters/platform/hash';
import coreMigration from '../../migrations/0001_core.sql?raw';

const ORIGIN = 'http://localhost:8787';
const OWNER_PHONE = '5511999990000';

export const MCP_REQUEST_HEADERS = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
export const TOOLS_LIST_BODY = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' });

export type SeededConnection = { accountId: string; agent: string; secret: string; secretDigest: string };

export async function applyCoreSchema(): Promise<void> {
  const statements = coreMigration.split(';').filter((statement) => statement.trim().length > 0);
  await env.CONNECTIONS.batch(statements.map((statement) => env.CONNECTIONS.prepare(statement)));
}

export async function seedConnection(input: { accountId: string; agent: string }): Promise<SeededConnection> {
  const secret = generateConnectionSecret();
  const secretDigest = await hashConnectionSecret({ secret });
  await env.CONNECTIONS.batch([
    env.CONNECTIONS.prepare('INSERT OR IGNORE INTO accounts (id, created_at) VALUES (?, ?)').bind(input.accountId, 0),
    env.CONNECTIONS.prepare(
      'INSERT OR IGNORE INTO owner_identities (wa_id, account_id, from_user_id, locale, created_at) VALUES (?, ?, ?, ?, ?)',
    ).bind(OWNER_PHONE, input.accountId, OWNER_PHONE, OwnerLocale.PortugueseBrazil, 0),
    env.CONNECTIONS.prepare('INSERT INTO connections (id, account_id, agent, secret_digest, created_at) VALUES (?, ?, ?, ?, ?)').bind(
      `conn_${input.agent}`,
      input.accountId,
      input.agent,
      secretDigest,
      0,
    ),
  ]);
  return { accountId: input.accountId, agent: input.agent, secret, secretDigest };
}

export function postMcp(input: { path: string; bearer?: string }): Promise<Response> {
  const authorization: Record<string, string> = input.bearer ? { authorization: `Bearer ${input.bearer}` } : {};
  return exports.default.fetch(
    new Request(`${ORIGIN}${input.path}`, { method: 'POST', headers: { ...MCP_REQUEST_HEADERS, ...authorization }, body: TOOLS_LIST_BODY }),
  );
}

export async function connectClient(input: { secret: string }): Promise<Client> {
  const client = new Client({ name: 'mcp-test', version: '0.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${ORIGIN}/c/${input.secret}/mcp`), {
    fetch: (request, init) => exports.default.fetch(new Request(request, init)),
  });
  await client.connect(transport);
  return client;
}

export type ToolResult = {
  isError?: boolean;
  content: { type: string; text?: string; data?: string; mimeType?: string }[];
  structuredContent?: Record<string, unknown>;
};

export async function callTool(input: { client: Client; name: string; arguments: Record<string, unknown> }): Promise<ToolResult> {
  return (await input.client.callTool({ name: input.name, arguments: input.arguments })) as ToolResult;
}

export function accountInbox(input: { accountId: string }): DevAccountInboxRpc {
  const stub = env.ACCOUNT_INBOX.get(env.ACCOUNT_INBOX.idFromName(input.accountId));
  return stub as unknown as DevAccountInboxRpc;
}

export async function ownerWrites(input: { accountId: string; channelMessageId: string; content: OwnerInboundContent }): Promise<string> {
  const outcome = await accountInbox({ accountId: input.accountId }).receiveOwnerMessage({
    ownerLocale: OwnerLocale.PortugueseBrazil,
    channelMessageId: input.channelMessageId,
    ownerMessage: { at: Date.now(), replyToMessageId: null, content: input.content },
  });
  if (!outcome.ok || outcome.value.messageId === null) throw new Error('owner message was not stored');
  return outcome.value.messageId;
}

export function ownerText(input: { text: string }): OwnerInboundContent {
  return { kind: MessageKind.Text, text: input.text };
}

export async function storeOwnerImage(input: { accountId: string; mediaId: string; sizeBytes: number }): Promise<void> {
  await env.MEDIA.put(`accounts/${input.accountId}/media/${input.mediaId}`, new Uint8Array(input.sizeBytes));
}

export async function receiveUpload(input: { accountId: string; uploadId: string; sizeBytes: number }): Promise<void> {
  await storeOwnerImage({ accountId: input.accountId, mediaId: input.uploadId, sizeBytes: input.sizeBytes });
  await accountInbox({ accountId: input.accountId }).completeUpload({ mediaId: input.uploadId });
}
