import { createOperatorKey, hashOperatorKey } from '../../src/backoffice/operator-mcp/operator-key';
import { OPERATOR_KEY_ID_BYTES, OPERATOR_KEY_SECRET_BYTES } from '../../src/backoffice/operator-mcp/operator-mcp-constants';
import type { Bindings } from '../../src/contract/env';
import production from '../../src/index';
import { createExecutionContext } from 'cloudflare:test';
import { BACKOFFICE_ORIGIN, backofficeEnv, CLIENT_ADDRESS } from '../integration/backoffice-auth-fixtures';
import { testEnv } from './workers-env';

export type OperatorKeyRow = {
  id: string;
  label: string;
  key_digest: string;
  created_at: number;
  expires_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
};

export type ToolOutcome = { status: number; isError: boolean; structured: Record<string, unknown>; text: string };

const JSON_HEADERS = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
const MCP_PATH = '/mcp';

export async function seedOperatorKey(input: {
  label?: string;
  createdAt: number;
  expiresAt: number;
  revokedAt?: number | null;
  lastUsedAt?: number | null;
}): Promise<{ key: string; keyId: string }> {
  const { label = 'seeded agent', createdAt, expiresAt, revokedAt = null, lastUsedAt = null } = input;
  const material = createOperatorKey({
    idBytes: crypto.getRandomValues(new Uint8Array(OPERATOR_KEY_ID_BYTES)),
    secretBytes: crypto.getRandomValues(new Uint8Array(OPERATOR_KEY_SECRET_BYTES)),
  });
  await testEnv.CONNECTIONS.prepare(
    'INSERT INTO backoffice_agent_keys (id, label, key_digest, created_at, expires_at, last_used_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(material.keyId, label, await hashOperatorKey({ key: material.key }), createdAt, expiresAt, lastUsedAt, revokedAt)
    .run();
  return material;
}

export async function operatorKeyRows(): Promise<OperatorKeyRow[]> {
  const { results } = await testEnv.CONNECTIONS.prepare(
    'SELECT * FROM backoffice_agent_keys ORDER BY created_at, rowid',
  ).all<OperatorKeyRow>();
  return results;
}

export function requestOperatorMcp(input: {
  method?: string;
  bearer?: string;
  body?: unknown;
  headers?: Record<string, string>;
  env?: Bindings;
  origin?: string;
}): Promise<Response> {
  const { method = 'POST', bearer, body, headers, env = backofficeEnv({}), origin = BACKOFFICE_ORIGIN } = input;
  const authorization: Record<string, string> = bearer === undefined ? {} : { authorization: `Bearer ${bearer}` };
  const request = new Request(`${origin}${MCP_PATH}`, {
    method,
    headers: { 'cf-connecting-ip': CLIENT_ADDRESS, ...JSON_HEADERS, ...authorization, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return Promise.resolve(production.fetch(request, env, createExecutionContext()));
}

export async function callOperatorTool(input: {
  bearer: string;
  name: string;
  arguments?: Record<string, unknown>;
  env?: Bindings;
}): Promise<ToolOutcome> {
  const response = await requestOperatorMcp({
    bearer: input.bearer,
    env: input.env,
    body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: input.name, arguments: input.arguments } },
  });
  const payload = (await response.json()) as {
    result?: { isError?: boolean; structuredContent?: Record<string, unknown>; content: { text: string }[] };
  };
  const result = payload.result;
  if (result === undefined) return { status: response.status, isError: true, structured: {}, text: JSON.stringify(payload) };
  return {
    status: response.status,
    isError: result.isError === true,
    structured: result.structuredContent === undefined ? {} : result.structuredContent,
    text: result.content.map((part) => part.text).join('\n'),
  };
}
