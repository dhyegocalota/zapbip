import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MessageDirection, MessageKind } from '@zapbip/types';
import { inject } from 'vitest';
import type { ScreenEntry } from '../../src/contract/account-inbox-rpc';
import { McpToolName } from '../../src/contract/tool-definitions';

const CLIENT_NAME = 'zapbip-e2e';
const CLIENT_VERSION = '0.0.0';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

export type ToolResult = { isError: boolean; structured: Record<string, unknown> | null; text: string; blockTypes: string[] };
export type OwnerReceipt = { message_id: string | null; agent: string | null; duplicate: boolean };

export function stack() {
  return inject('stack');
}

export function secretOf(input: { agent: string }): string {
  const secret = stack().secrets[input.agent];
  if (!secret) throw new Error(`no seeded secret for ${input.agent}`);
  return secret;
}

export function mcpUrl(input: { secret: string }): string {
  return `${stack().origin}/c/${input.secret}/mcp`;
}

export async function connectAgent(input: { agent: string }): Promise<Client> {
  const client = new Client({ name: CLIENT_NAME, version: CLIENT_VERSION });
  await client.connect(new StreamableHTTPClientTransport(new URL(mcpUrl({ secret: secretOf(input) }))));
  return client;
}

export async function callTool(input: { client: Client; name: McpToolName; arguments: Record<string, unknown> }): Promise<ToolResult> {
  const result = await input.client.callTool({ name: input.name, arguments: input.arguments });
  const content = Array.isArray(result.content) ? result.content : [];
  const text = content.map((block) => (block.type === 'text' ? block.text : '')).join('\n');
  const structured = result.structuredContent === undefined ? null : (result.structuredContent as Record<string, unknown>);
  return { isError: result.isError === true, structured, text, blockTypes: content.map((block) => block.type) };
}

export async function postOwner(input: { body: Record<string, unknown> }): Promise<OwnerReceipt> {
  const response = await fetch(`${stack().origin}/dev/owner/${stack().phone}/messages`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input.body),
  });
  if (!response.ok) throw new Error(`owner simulator answered ${response.status}`);
  return (await response.json()) as OwnerReceipt;
}

export function postOwnerText(input: { text: string; replyTo: string | null }): Promise<OwnerReceipt> {
  return postOwner({ body: { kind: MessageKind.Text, text: input.text, reply_to: input.replyTo } });
}

export async function readScreen(): Promise<ScreenEntry[]> {
  const response = await fetch(`${stack().origin}/dev/owner/${stack().phone}/screen`);
  const body = (await response.json()) as { entries: ScreenEntry[] };
  return body.entries;
}

export async function advanceClock(input: { advanceMs: number }): Promise<void> {
  await fetch(`${stack().origin}/dev/owner/${stack().phone}/clock`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ advance_ms: input.advanceMs }),
  });
}

type WireOption = { option_id: string; title: string };
type WireMessage = {
  kind: MessageKind;
  direction: MessageDirection;
  choice: { question_id: string; options: WireOption[] } | null;
  url: string | null;
};

export async function historyOf(input: { client: Client }): Promise<WireMessage[]> {
  const result = await callTool({ client: input.client, name: McpToolName.GetMessages, arguments: {} });
  if (!result.structured) throw new Error(`get_messages answered without structured content: ${result.text}`);
  return result.structured.history as WireMessage[];
}

export async function lastQuestion(input: { client: Client }): Promise<WireMessage['choice']> {
  const questions = (await historyOf({ client: input.client })).filter(
    (message) => message.kind === MessageKind.Choice && message.direction === MessageDirection.ToOwner,
  );
  const latest = questions.at(-1);
  if (!latest) return null;
  return latest.choice;
}

export async function tapLastQuestion(input: { client: Client; optionIndex: number }): Promise<void> {
  const question = await lastQuestion({ client: input.client });
  const option = question?.options[input.optionIndex];
  if (!option) throw new Error('no option to tap');
  await postOwner({ body: { kind: MessageKind.Choice, option_id: option.option_id, title: option.title } });
}
