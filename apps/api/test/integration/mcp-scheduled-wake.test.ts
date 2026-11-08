import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InboxStatus, MessageKind, SetWakeStatus, WakeMode, WakeProvider, WakeRung } from '@zapbip/types';
import { reset } from 'cloudflare:test';
import { generateConnectionSecret } from '../../src/adapters/platform/connection-secret';
import { McpToolName } from '../../src/contract/tool-definitions';
import { applyDirectoryMigration, seedConnection } from '../support/seed';
import { callTool, connectClient, ownerText, ownerWrites, seedConnectionWithSecret, type ToolResult } from './mcp-fixtures';

const ACCOUNT_ID = 'acc_1';
const OTHER_ACCOUNT_ID = 'acc_2';
const CALLER = 'agent-nine';
const STANDBY_AGENT = 'agent-eight';
const SECOND_STANDBY_AGENT = 'agent-ten';
const OTHER_ACCOUNT_AGENT = 'stranger';
const GROK_URL = 'https://api2.cursor.sh/automations/webhook/abcdefgh12';
const PINNED_TOKEN = 'p'.repeat(16);
const INTERVAL_MINUTES = 60;
const MIN_INTERVAL_MINUTES = 1;
const MAX_INTERVAL_MINUTES = 1440;
const BELOW_MIN_INTERVAL_MINUTES = 0;
const ABOVE_MAX_INTERVAL_MINUTES = 1441;
const FRACTIONAL_INTERVAL_MINUTES = 60.5;
const MALFORMED_AGENT_NAME = 'Grok Bot!';
const ONE_HOP_TEXT = 'one hop';
const FIRST_CHANNEL_MESSAGE_ID = 'wamid.first';
const SECOND_CHANNEL_MESSAGE_ID = 'wamid.second';

describe('set_wake and check_inbox over MCP for the scheduled and standby modes', () => {
  let client: Client;

  function setWake(input: Record<string, unknown>): Promise<ToolResult> {
    return callTool({ client, name: McpToolName.SetWake, arguments: input });
  }

  function textOf(result: ToolResult): string {
    return result.content.map((part) => part.text).join('');
  }

  async function connectAgent(input: { accountId: string; agent: string }): Promise<Client> {
    const secret = generateConnectionSecret();
    await seedConnection({ accountId: input.accountId, agent: input.agent, secret });
    return connectClient({ secret });
  }

  async function saveWebhookWake(input: { agentClient: Client }): Promise<void> {
    await callTool({
      client: input.agentClient,
      name: McpToolName.SetWake,
      arguments: { mode: WakeMode.Webhook, url: GROK_URL, token: PINNED_TOKEN },
    });
  }

  afterEach(reset);

  beforeEach(async () => {
    await applyDirectoryMigration();
    const connection = await seedConnectionWithSecret({ accountId: ACCOUNT_ID, agent: CALLER });
    client = await connectClient({ secret: connection.secret });
  });

  it('scheduled set_wake', async () => {
    const result = await setWake({ mode: WakeMode.Scheduled, interval_minutes: INTERVAL_MINUTES });
    expect(result.structuredContent).toEqual({
      status: SetWakeStatus.Saved,
      wake_mode: WakeMode.Scheduled,
      effective_rung: WakeRung.Scheduled,
      provider: null,
    });
  });

  it.each([MIN_INTERVAL_MINUTES, MAX_INTERVAL_MINUTES])('accepts the interval bound %s', async (intervalMinutes) => {
    const result = await setWake({ mode: WakeMode.Scheduled, interval_minutes: intervalMinutes });
    expect(result.structuredContent?.wake_mode).toBe(WakeMode.Scheduled);
  });

  it('standby set_wake', async () => {
    await saveWebhookWake({ agentClient: await connectAgent({ accountId: ACCOUNT_ID, agent: STANDBY_AGENT }) });
    const result = await setWake({ mode: WakeMode.Standby, standby_agent: STANDBY_AGENT });
    expect(result.structuredContent).toEqual({
      status: SetWakeStatus.Saved,
      wake_mode: WakeMode.Standby,
      effective_rung: WakeRung.Standby,
      provider: null,
    });
  });

  it('pin: set_wake none answers the inbox rung', async () => {
    const result = await setWake({ mode: WakeMode.None });
    expect(result.structuredContent).toEqual({
      status: SetWakeStatus.Saved,
      wake_mode: WakeMode.None,
      effective_rung: WakeRung.Inbox,
      provider: null,
    });
  });

  it('pin: set_wake webhook still answers the webhook rung', async () => {
    const result = await setWake({ mode: WakeMode.Webhook, url: GROK_URL, token: PINNED_TOKEN });
    expect(result.structuredContent).toEqual({
      status: SetWakeStatus.Saved,
      wake_mode: WakeMode.Webhook,
      effective_rung: WakeRung.Webhook,
      provider: WakeProvider.GrokRoutine,
    });
  });

  it.each([
    { name: 'below the minimum', intervalMinutes: BELOW_MIN_INTERVAL_MINUTES, bound: String(MIN_INTERVAL_MINUTES) },
    { name: 'above the maximum', intervalMinutes: ABOVE_MAX_INTERVAL_MINUTES, bound: String(MAX_INTERVAL_MINUTES) },
  ])('rejects an interval $name naming the field and the bound', async ({ intervalMinutes, bound }) => {
    const result = await setWake({ mode: WakeMode.Scheduled, interval_minutes: intervalMinutes });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('interval_minutes');
    expect(textOf(result)).toContain(bound);
  });

  it('pin: rejects an interval that is a string naming the field', async () => {
    const result = await setWake({ mode: WakeMode.Scheduled, interval_minutes: String(INTERVAL_MINUTES) });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('interval_minutes');
  });

  it('rejects a fractional interval naming the field', async () => {
    const result = await setWake({ mode: WakeMode.Scheduled, interval_minutes: FRACTIONAL_INTERVAL_MINUTES });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('interval_minutes');
  });

  it('rejects an unknown field naming it', async () => {
    const result = await setWake({ mode: WakeMode.None, account_id: 'x' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('account_id');
  });

  it('rejects an agent name in the input', async () => {
    const result = await setWake({ mode: WakeMode.Scheduled, interval_minutes: INTERVAL_MINUTES, agent: 'other' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('agent');
  });

  it('rejects the caller as its own standby', async () => {
    const result = await setWake({ mode: WakeMode.Standby, standby_agent: CALLER });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('standby_agent');
  });

  it('rejects a malformed standby name', async () => {
    const result = await setWake({ mode: WakeMode.Standby, standby_agent: MALFORMED_AGENT_NAME });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('standby_agent');
  });

  it('rejects a standby that exists only in another account without leaking it', async () => {
    await seedConnection({ accountId: OTHER_ACCOUNT_ID, agent: OTHER_ACCOUNT_AGENT, secret: generateConnectionSecret() });
    const result = await setWake({ mode: WakeMode.Standby, standby_agent: OTHER_ACCOUNT_AGENT });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('standby_agent');
    expect(textOf(result)).not.toContain(OTHER_ACCOUNT_ID);
  });

  it('rejects a standby that is itself in standby mode', async () => {
    const standbyClient = await connectAgent({ accountId: ACCOUNT_ID, agent: STANDBY_AGENT });
    await saveWebhookWake({ agentClient: await connectAgent({ accountId: ACCOUNT_ID, agent: SECOND_STANDBY_AGENT }) });
    await callTool({
      client: standbyClient,
      name: McpToolName.SetWake,
      arguments: { mode: WakeMode.Standby, standby_agent: SECOND_STANDBY_AGENT },
    });
    const result = await setWake({ mode: WakeMode.Standby, standby_agent: STANDBY_AGENT });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('standby_agent');
    expect(textOf(result)).toContain(ONE_HOP_TEXT);
  });

  it('pin: check_inbox answers empty when nothing is unread', async () => {
    const result = await callTool({ client, name: McpToolName.CheckInbox, arguments: {} });
    expect(result.structuredContent).toEqual({ status: InboxStatus.Empty, messages: [] });
  });

  it('pin: check_inbox answers new with the unread messages', async () => {
    await ownerWrites({ accountId: ACCOUNT_ID, channelMessageId: FIRST_CHANNEL_MESSAGE_ID, content: ownerText({ text: 'one' }) });
    await ownerWrites({ accountId: ACCOUNT_ID, channelMessageId: SECOND_CHANNEL_MESSAGE_ID, content: ownerText({ text: 'two' }) });
    const result = await callTool({ client, name: McpToolName.CheckInbox, arguments: {} });
    const messages = result.structuredContent?.messages as { kind: string }[];
    expect(result.structuredContent?.status).toBe(InboxStatus.New);
    expect(messages.map((message) => message.kind)).toEqual([MessageKind.Text, MessageKind.Text]);
  });
});
