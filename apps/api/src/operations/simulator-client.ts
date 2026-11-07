import { MessageKind, TemplateKind } from '@zapbip/types';
import { z } from 'zod';
import type { ScreenEntry } from '../contract/account-inbox-rpc';
import { CONNECTION_SECRET_PREFIX } from '../contract/constants';
import { GET_REQUEST, type SmokeFetch } from './smoke-checks';

const MCP_URL_SECRET_PATTERN = new RegExp(`/c/(${CONNECTION_SECRET_PREFIX}[A-Za-z0-9_-]+)/mcp`);
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const screenSchema = z.object({
  entries: z.array(
    z.object({
      at: z.number(),
      messageId: z.string().nullable(),
      template: z.enum(TemplateKind).nullable(),
      text: z.string(),
      options: z.array(z.string()),
    }),
  ),
});

export type SimulatorTarget = { origin: string; phone: string; fetchRequest: SmokeFetch };

function ownerUrlOf(input: SimulatorTarget & { resource: string }): string {
  return `${input.origin}/dev/owner/${input.phone}/${input.resource}`;
}

export async function postOwnerText(input: SimulatorTarget & { text: string }): Promise<void> {
  const response = await input.fetchRequest(ownerUrlOf({ ...input, resource: 'messages' }), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ kind: MessageKind.Text, text: input.text }),
  });
  if (!response.ok) throw new Error(`owner simulator answered ${response.status}`);
}

export async function readOwnerScreen(input: SimulatorTarget): Promise<ScreenEntry[]> {
  const response = await input.fetchRequest(ownerUrlOf({ ...input, resource: 'screen' }), GET_REQUEST);
  if (!response.ok) throw new Error(`owner simulator answered ${response.status}`);
  return screenSchema.parse(await response.json()).entries;
}

export function mcpSecretOf(input: { entries: ScreenEntry[] }): string {
  const secrets = input.entries.map((entry) => entry.text.match(MCP_URL_SECRET_PATTERN)?.[1]).filter((secret) => secret !== undefined);
  const [secret] = secrets;
  if (secret === undefined) throw new Error('no mcp url on the owner screen');
  return secret;
}
