import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SetWakeStatus, WakeMode, WakeProvider, WakeRung } from '@zapbip/types';
import { env } from 'cloudflare:workers';
import { reset, runInDurableObject } from 'cloudflare:test';
import { McpToolName, TOOL_DEFINITIONS } from '../../src/contract/tool-definitions';
import { applyDirectoryMigration } from '../support/seed';
import { accountInboxStub } from '../support/workers-env';
import { callTool, connectClient, seedConnectionWithSecret, type ToolResult } from './mcp-fixtures';

const ACCOUNT_ID = 'acc_1';
const AGENT = 'alpha';
const GROK_URL = 'https://api2.cursor.sh/automations/webhook/abcdefgh12';
const CLAUDE_URL = 'https://api.anthropic.com/v1/claude_code/routines/trig_01abc/fire';
const GENERIC_HOST = 'hooks.example.com';
const GENERIC_URL = `https://${GENERIC_HOST}/wake`;
const INSECURE_URL = `http://${GENERIC_HOST}/wake`;
const PINNED_TOKEN = 'p'.repeat(16);
const GENERIC_TOKEN = 'g'.repeat(32);
const SHORT_TOKEN = 's'.repeat(15);
const UNAVAILABLE_MODE_MESSAGE = 'wake mode not available yet';
const UNAVAILABLE_MODES = ['local', 'scheduled', 'standby'];

describe('set_wake over MCP', () => {
  let client: Client;
  let secretDigest: string;

  function setWake(input: { mode: string; url?: string | null; token?: string | null }): Promise<ToolResult> {
    return callTool({
      client,
      name: McpToolName.SetWake,
      arguments: { mode: input.mode, url: input.url ?? null, token: input.token ?? null },
    });
  }

  function errorText(result: ToolResult): string {
    return result.content.map((part) => part.text).join('');
  }

  afterEach(reset);

  beforeEach(async () => {
    await applyDirectoryMigration();
    const connection = await seedConnectionWithSecret({ accountId: ACCOUNT_ID, agent: AGENT });
    secretDigest = connection.secretDigest;
    client = await connectClient({ secret: connection.secret });
  });

  it('lists set_wake with the other registered tools', async () => {
    const { tools } = await client.listTools();
    expect(Object.keys(TOOL_DEFINITIONS)).toContain(McpToolName.SetWake);
    expect(tools.map((tool) => tool.name)).toEqual(Object.keys(TOOL_DEFINITIONS));
  });

  it('saves a Grok routine without echoing the url or the token', async () => {
    const result = await setWake({ mode: WakeMode.Webhook, url: GROK_URL, token: PINNED_TOKEN });
    expect(result.structuredContent).toEqual({
      status: SetWakeStatus.Saved,
      wake_mode: WakeMode.Webhook,
      effective_rung: WakeRung.Webhook,
      provider: WakeProvider.GrokRoutine,
    });
    const text = errorText(result);
    expect(text).not.toContain(GROK_URL);
    expect(text).not.toContain(PINNED_TOKEN);
  });

  it('saves a Claude routine', async () => {
    const result = await setWake({ mode: WakeMode.Webhook, url: CLAUDE_URL, token: PINNED_TOKEN });
    expect(result.structuredContent?.provider).toBe(WakeProvider.ClaudeRoutine);
  });

  it('saves a generic webhook without returning its host', async () => {
    const result = await setWake({ mode: WakeMode.Webhook, url: GENERIC_URL, token: GENERIC_TOKEN });
    expect(result.structuredContent?.provider).toBe(WakeProvider.GenericWebhook);
    expect(errorText(result)).not.toContain(GENERIC_HOST);
  });

  it('rejects an insecure url naming the field and not echoing the value', async () => {
    const result = await setWake({ mode: WakeMode.Webhook, url: INSECURE_URL, token: GENERIC_TOKEN });
    expect(result.isError).toBe(true);
    expect(errorText(result)).toContain('url');
    expect(errorText(result)).not.toContain(GENERIC_HOST);
  });

  it('rejects a short token naming the field and not echoing the value', async () => {
    const result = await setWake({ mode: WakeMode.Webhook, url: GROK_URL, token: SHORT_TOKEN });
    expect(result.isError).toBe(true);
    expect(errorText(result)).toContain('token');
    expect(errorText(result)).not.toContain(SHORT_TOKEN);
  });

  it('rejects a webhook without a url', async () => {
    const result = await setWake({ mode: WakeMode.Webhook, token: PINNED_TOKEN });
    expect(result.isError).toBe(true);
    expect(errorText(result)).toContain('url');
  });

  it.each(UNAVAILABLE_MODES)('answers that the %s mode is not available yet', async (mode) => {
    const result = await setWake({ mode });
    expect(result.isError).toBe(true);
    expect(errorText(result)).toBe(UNAVAILABLE_MODE_MESSAGE);
  });

  it('clears a saved webhook', async () => {
    await setWake({ mode: WakeMode.Webhook, url: GROK_URL, token: PINNED_TOKEN });
    const result = await setWake({ mode: WakeMode.None });
    expect(result.structuredContent).toEqual({
      status: SetWakeStatus.Saved,
      wake_mode: WakeMode.None,
      effective_rung: WakeRung.Inbox,
      provider: null,
    });
  });

  it('answers a call with a revoked secret as unauthorized and stores no wake', async () => {
    await env.CONNECTIONS.prepare('DELETE FROM connections WHERE secret_digest = ?').bind(secretDigest).run();
    await expect(
      callTool({
        client,
        name: McpToolName.SetWake,
        arguments: { mode: WakeMode.Webhook, url: GROK_URL, token: PINNED_TOKEN },
      }),
    ).rejects.toThrow();
    const stored = await runInDurableObject(accountInboxStub({ accountId: ACCOUNT_ID }), (_instance, state) =>
      state.storage.sql.exec('SELECT agent FROM agent_wake WHERE agent = ?', AGENT).toArray(),
    );
    expect(stored).toEqual([]);
  });
});
