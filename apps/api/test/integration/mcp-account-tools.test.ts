import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  AGENT_CHANGE_APPROVAL_TIMEOUT_MS,
  ACCOUNT_CHANGES_PER_MINUTE,
  ApprovalChoice,
  approvalTitlesOf,
  formatOptionId,
} from '@zapbip/core';
import {
  AccountPlan,
  AccountReplyIntent,
  AccountState,
  AgentChangeStatus,
  MessageKind,
  OwnerLocale,
  PRICING_FREE_MESSAGES,
} from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { D1ConnectionRegistry } from '../../src/adapters/d1/d1-connection-registry';
import { McpToolName, TOOL_DEFINITIONS } from '../../src/contract/tool-definitions';
import { generateConnectionSecret } from '../../src/adapters/platform/connection-secret';
import { applyDirectoryMigration, seedAccount, seedConnection } from '../support/seed';
import { captureLogLines } from '../support/capture-log-lines';
import { readScreen } from '../support/inbox-session';
import { accountInboxStub, testEnv } from '../support/workers-env';
import { callTool, connectClient, openWindow, ownerWrites, seedConnectionWithSecret, type ToolResult } from './mcp-fixtures';

const ACCOUNT_PREFIX = 'acc_agentic';
const AGENT = 'alpha';
const SIBLING_AGENT = 'beta';
const INSTALL_LINK_MARKER = '/i/zb_inst_';
const SIGN_IN_LINK_MARKER = '/sign-in/';
const CONNECTION_SECRET_MARKER = 'zb_conn_';
const HELD_QUESTION_WAIT_MS = 10_000;
const SHORT_APPROVAL_TIMEOUT_MS = 300;
const RATE_LIMITED_CODE = 'rate_limited';
const TITLES = approvalTitlesOf({ locale: OwnerLocale.PortugueseBrazil });
const ALLOW = TITLES[ApprovalChoice.Allow];
const ALLOW_AND_SEND = TITLES[ApprovalChoice.AllowAndSend];
const DENY = TITLES[ApprovalChoice.Deny];

type HeldQuestion = { questionId: string; titles: string[]; agent: string | null };

let accountCounter = 0;

async function seedAgent(input: { accountId: string; agent: string }): Promise<string> {
  const secret = generateConnectionSecret();
  await seedAccount({ accountId: input.accountId });
  await seedConnection({ ...input, secret });
  return secret;
}

describe('MCP account tools', () => {
  let client: Client;
  let accountId: string;
  let otherAccountId: string;
  const inFlight: Promise<ToolResult>[] = [];

  function call(input: { name: McpToolName; arguments?: Record<string, unknown>; as?: Client }): Promise<ToolResult> {
    const pending = callTool({
      client: input.as === undefined ? client : input.as,
      name: input.name,
      arguments: input.arguments === undefined ? {} : input.arguments,
    });
    inFlight.push(pending);
    return pending;
  }

  function heldQuestion(): Promise<HeldQuestion> {
    return vi.waitFor(async () => {
      const { structuredContent } = await callTool({ client, name: McpToolName.GetMessages, arguments: {} });
      const history = structuredContent?.history as {
        kind: string;
        agent: string | null;
        choice: { question_id: string; options: { title: string }[] } | null;
      }[];
      const question = history.filter((message) => message.kind === MessageKind.Choice && message.choice !== null).at(-1);
      if (question === undefined || question.choice === null) throw new Error('the approval question is not stored yet');
      return {
        questionId: question.choice.question_id,
        titles: question.choice.options.map((option) => option.title),
        agent: question.agent,
      };
    }, HELD_QUESTION_WAIT_MS);
  }

  async function ownerTaps(input: { title: string }): Promise<void> {
    const { questionId, titles } = await heldQuestion();
    await ownerWrites({
      accountId,
      channelMessageId: `wamid.tap.${questionId}`,
      content: {
        kind: MessageKind.Choice,
        optionId: formatOptionId({ questionId, optionIndex: titles.indexOf(input.title) }),
        optionTitle: input.title,
        optionDescription: null,
      },
    });
  }

  async function activeAgents(input: { accountId: string }): Promise<string[]> {
    const active = await new D1ConnectionRegistry({ database: testEnv.CONNECTIONS }).listActive(input);
    return active.map((connection) => connection.agent);
  }

  async function screenText(): Promise<string> {
    const entries = await readScreen({ stub: accountInboxStub({ accountId }) });
    return entries.map((entry) => entry.text).join('\n');
  }

  beforeEach(async () => {
    accountCounter += 1;
    accountId = `${ACCOUNT_PREFIX}_${accountCounter}`;
    otherAccountId = `${ACCOUNT_PREFIX}_other_${accountCounter}`;
    await applyDirectoryMigration();
    const connection = await seedConnectionWithSecret({ accountId, agent: AGENT });
    client = await connectClient({ secret: connection.secret });
    await openWindow({ client, accountId });
  });

  afterEach(async () => {
    await Promise.allSettled(inFlight.splice(0));
    await reset();
  });

  it('registers the five account tools after the existing ones and keeps deletion off the list', () => {
    const names = Object.keys(TOOL_DEFINITIONS);
    expect(names.slice(-5)).toEqual([
      McpToolName.ListAgents,
      McpToolName.AccountStatus,
      McpToolName.ConnectAgent,
      McpToolName.RevokeAgent,
      McpToolName.SignInLink,
    ]);
    expect(TOOL_DEFINITIONS[McpToolName.SignInLink].description).toContain('Deleting the account is only possible by WhatsApp command');
  });

  describe('list_agents and account_status', () => {
    it('lists the agents of this account only, with no secret field', async () => {
      await seedAgent({ accountId: otherAccountId, agent: 'stranger' });
      const result = await call({ name: McpToolName.ListAgents });
      const agents = result.structuredContent?.agents as {
        name: string;
        client: string | null;
        created_at: string;
        last_active_at: string | null;
      }[];
      expect(agents.map((agent) => agent.name)).toEqual([AGENT]);
      expect(Object.keys(agents[0]!).sort()).toEqual(['client', 'created_at', 'last_active_at', 'name']);
      expect(JSON.stringify(result)).not.toContain(CONNECTION_SECRET_MARKER);
    });

    it('reads the account with the masked phone, the plan and its free allowance', async () => {
      const result = await call({ name: McpToolName.AccountStatus });
      expect(result.structuredContent).toEqual({
        state: AccountState.Active,
        phone: '+55 ••••-0000',
        plan: AccountPlan.Free,
        free_messages: PRICING_FREE_MESSAGES,
      });
    });
  });

  describe('connect_agent', () => {
    it('asks the owner from the calling agent and, on Allow, connects the agent and sends the install link to the owner only', async () => {
      const logs = captureLogLines();
      const connecting = call({ name: McpToolName.ConnectAgent, arguments: { name: 'codex' } });
      const question = await heldQuestion();
      expect(question).toMatchObject({ agent: AGENT, titles: [ALLOW, ALLOW_AND_SEND, DENY] });
      await ownerTaps({ title: ALLOW });
      const result = await connecting;
      expect(result.structuredContent).toEqual({ status: AgentChangeStatus.Applied, agent: 'codex', reason: null, install_prompt: null });
      expect(await activeAgents({ accountId })).toEqual([AGENT, 'codex']);
      expect(await screenText()).toContain(INSTALL_LINK_MARKER);
      expect(JSON.stringify(result)).not.toContain(INSTALL_LINK_MARKER);
      expect(logs.join('\n')).not.toContain(INSTALL_LINK_MARKER);
      expect(logs.join('\n')).not.toContain(CONNECTION_SECRET_MARKER);
    });

    it('returns the install prompt to the agent only when the owner taps the button that sends it there', async () => {
      const connecting = call({ name: McpToolName.ConnectAgent, arguments: { name: 'codex' } });
      await ownerTaps({ title: ALLOW_AND_SEND });
      const result = await connecting;
      expect(result.structuredContent).toMatchObject({ status: AgentChangeStatus.Applied, agent: 'codex' });
      expect(String(result.structuredContent?.install_prompt)).toContain(INSTALL_LINK_MARKER);
      expect(JSON.stringify(result)).not.toContain(CONNECTION_SECRET_MARKER);
      expect(await screenText()).not.toContain(INSTALL_LINK_MARKER);
    });

    it('changes nothing when the owner taps Deny', async () => {
      const connecting = call({ name: McpToolName.ConnectAgent, arguments: { name: 'codex' } });
      await ownerTaps({ title: DENY });
      expect((await connecting).structuredContent).toEqual({
        status: AgentChangeStatus.Denied,
        agent: 'codex',
        reason: null,
        install_prompt: null,
      });
      expect(await activeAgents({ accountId })).toEqual([AGENT]);
    });

    it('changes nothing when nobody answers in time, even if the owner taps afterwards', async () => {
      await runInDurableObject(accountInboxStub({ accountId }), (instance) => {
        (instance as unknown as { approvalTimeoutMs: number }).approvalTimeoutMs = SHORT_APPROVAL_TIMEOUT_MS;
      });
      const result = await call({ name: McpToolName.ConnectAgent, arguments: { name: 'codex' } });
      expect(result.structuredContent).toEqual({ status: AgentChangeStatus.TimedOut, agent: 'codex', reason: null, install_prompt: null });
      await ownerTaps({ title: ALLOW });
      expect(await activeAgents({ accountId })).toEqual([AGENT]);
    });

    it('waits for the production approval window by default', async () => {
      const waitMs = await runInDurableObject(accountInboxStub({ accountId }), (instance) => {
        return (instance as unknown as { approvalTimeoutMs: number }).approvalTimeoutMs;
      });
      expect(waitMs).toBe(AGENT_CHANGE_APPROVAL_TIMEOUT_MS);
    });

    it('refuses an invalid name without asking the owner', async () => {
      const result = await call({ name: McpToolName.ConnectAgent, arguments: { name: '!!!' } });
      expect(result.structuredContent).toEqual({
        status: AgentChangeStatus.Refused,
        agent: null,
        reason: AccountReplyIntent.InvalidName,
        install_prompt: null,
      });
      expect(await screenText()).not.toContain(DENY);
    });

    it('routes the tap back to the agent that asked, not to a sibling agent', async () => {
      const siblingClient = await connectClient({ secret: await seedAgent({ accountId, agent: SIBLING_AGENT }) });
      const connecting = call({ name: McpToolName.ConnectAgent, arguments: { name: 'codex' } });
      await ownerTaps({ title: DENY });
      await connecting;
      const siblingInbox = await call({ name: McpToolName.CheckInbox, as: siblingClient });
      expect(siblingInbox.structuredContent?.messages).toEqual([]);
    });
  });

  describe('revoke_agent', () => {
    it('revokes an agent of this account after the owner allows it', async () => {
      const siblingSecret = await seedAgent({ accountId, agent: SIBLING_AGENT });
      const revoking = call({ name: McpToolName.RevokeAgent, arguments: { name: SIBLING_AGENT } });
      expect(await heldQuestion()).toMatchObject({ titles: [ALLOW, DENY] });
      await ownerTaps({ title: ALLOW });
      expect((await revoking).structuredContent).toMatchObject({ status: AgentChangeStatus.Applied, agent: SIBLING_AGENT });
      expect(await activeAgents({ accountId })).toEqual([AGENT]);
      await expect(connectClient({ secret: siblingSecret })).rejects.toThrow();
    });

    it('keeps the agent when the owner taps Deny', async () => {
      await seedAgent({ accountId, agent: SIBLING_AGENT });
      const revoking = call({ name: McpToolName.RevokeAgent, arguments: { name: SIBLING_AGENT } });
      await ownerTaps({ title: DENY });
      expect((await revoking).structuredContent).toMatchObject({ status: AgentChangeStatus.Denied });
      expect(await activeAgents({ accountId })).toEqual([AGENT, SIBLING_AGENT]);
    });

    it('never reaches an agent of another account and does not ask the owner', async () => {
      await seedAgent({ accountId: otherAccountId, agent: 'stranger' });
      const result = await call({ name: McpToolName.RevokeAgent, arguments: { name: 'stranger' } });
      expect(result.structuredContent).toMatchObject({ status: AgentChangeStatus.Refused, reason: AccountReplyIntent.NotFound });
      expect(await activeAgents({ accountId: otherAccountId })).toEqual(['stranger']);
    });
  });

  describe('sign_in_link', () => {
    it('sends the sign-in link to the owner and never returns it to the agent', async () => {
      const result = await call({ name: McpToolName.SignInLink });
      expect(result.structuredContent).toEqual({ status: AgentChangeStatus.Applied, agent: null, reason: null, install_prompt: null });
      expect(await screenText()).toContain(SIGN_IN_LINK_MARKER);
      expect(JSON.stringify(result)).not.toContain(SIGN_IN_LINK_MARKER);
    });
  });

  describe('rate limit', () => {
    it('refuses the acting tools beyond the minute limit per connection and keeps reading free', async () => {
      const results = await Array.from({ length: ACCOUNT_CHANGES_PER_MINUTE + 1 }).reduce<Promise<ToolResult[]>>(
        async (previous) => [...(await previous), await call({ name: McpToolName.SignInLink })],
        Promise.resolve([]),
      );
      const refused = results.at(-1)!;
      expect(results.slice(0, ACCOUNT_CHANGES_PER_MINUTE).every((result) => result.isError !== true)).toBe(true);
      expect(refused.isError).toBe(true);
      expect(refused.content[0]?.text).toContain(RATE_LIMITED_CODE);
      expect((await call({ name: McpToolName.ListAgents })).isError).not.toBe(true);
    });
  });
});
