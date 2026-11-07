import { OUTBOUND_MESSAGES_PER_MINUTE } from '@zapbip/core';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { McpToolName } from '../../src/contract/tool-definitions';
import { generateConnectionSecret } from '../../src/adapters/platform/connection-secret';
import { applyDirectoryMigration, seedConnection } from '../support/seed';
import { accountInboxStub } from '../support/workers-env';
import { callTool, connectClient, seedConnectionWithSecret, type ToolResult } from './mcp-fixtures';

const RATE_LIMITED_CODE = 'rate_limited';
const SENDS_BEYOND_TWO_WINDOWS = OUTBOUND_MESSAGES_PER_MINUTE * 2 + 1;
const COUNT_OWNER_BOUND_STATEMENT = "SELECT COUNT(*) AS total FROM inbox_messages WHERE direction = 'to_owner'";

async function ownerBoundCount(input: { accountId: string }): Promise<number> {
  const [row] = await runInDurableObject(accountInboxStub(input), (_instance, state) =>
    state.storage.sql.exec<{ total: number }>(COUNT_OWNER_BOUND_STATEMENT).toArray(),
  );
  if (row === undefined) throw new Error('count missing');
  return row.total;
}

async function sendMany(input: { secret: string; count: number }): Promise<ToolResult[]> {
  const client = await connectClient({ secret: input.secret });
  return Array.from({ length: input.count }).reduce<Promise<ToolResult[]>>(
    async (results) => [...(await results), await callTool({ client, name: McpToolName.SendMessage, arguments: { text: 'oi' } })],
    Promise.resolve([]),
  );
}

describe('MCP outbound limit', () => {
  beforeEach(async () => {
    await applyDirectoryMigration();
  });

  afterEach(reset);

  it('[row 409] admits thirty send_message calls in one minute and every one reaches the owner', async () => {
    const first = await seedConnectionWithSecret({ accountId: 'acc_out', agent: 'alpha' });
    const results = await sendMany({ secret: first.secret, count: OUTBOUND_MESSAGES_PER_MINUTE });
    expect(results.every((result) => result.isError !== true)).toBe(true);
    expect(await ownerBoundCount({ accountId: 'acc_out' })).toBe(OUTBOUND_MESSAGES_PER_MINUTE);
  });

  it('[row 410] refuses a send_message beyond the minute limit with rate_limited and sends nothing for it', async () => {
    const first = await seedConnectionWithSecret({ accountId: 'acc_out4', agent: 'alpha' });
    const results = await sendMany({ secret: first.secret, count: SENDS_BEYOND_TWO_WINDOWS });
    const admitted = results.filter((result) => result.isError !== true);
    const refused = results.filter((result) => result.isError === true);
    expect(admitted.length).toBeGreaterThanOrEqual(OUTBOUND_MESSAGES_PER_MINUTE);
    expect(refused.length).toBeGreaterThan(0);
    expect(refused.every((result) => result.content[0]?.text?.includes(RATE_LIMITED_CODE))).toBe(true);
    expect(await ownerBoundCount({ accountId: 'acc_out4' })).toBe(admitted.length);
  });

  it('[row 411] counts per connection, so a second connection of the account still sends', async () => {
    const first = await seedConnectionWithSecret({ accountId: 'acc_out2', agent: 'alpha' });
    const secondSecret = generateConnectionSecret();
    await seedConnection({ accountId: 'acc_out2', agent: 'beta', secret: secondSecret });
    await sendMany({ secret: first.secret, count: OUTBOUND_MESSAGES_PER_MINUTE + 1 });
    const [sent] = await sendMany({ secret: secondSecret, count: 1 });
    expect(sent?.isError).not.toBe(true);
  });

  it('does not count check_inbox toward the outbound limit', async () => {
    const connection = await seedConnectionWithSecret({ accountId: 'acc_out3', agent: 'alpha' });
    const client = await connectClient({ secret: connection.secret });
    const results = await Array.from({ length: OUTBOUND_MESSAGES_PER_MINUTE + 1 }).reduce<Promise<ToolResult[]>>(
      async (collected) => [...(await collected), await callTool({ client, name: McpToolName.CheckInbox, arguments: {} })],
      Promise.resolve([]),
    );
    expect(results.every((result) => result.isError !== true)).toBe(true);
  });
});
