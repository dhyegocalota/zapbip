import { OUTBOUND_MESSAGES_PER_MINUTE } from '@zapbip/core';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { McpToolName } from '../../src/contract/tool-definitions';
import { generateConnectionSecret } from '../../src/adapters/platform/connection-secret';
import { applyDirectoryMigration, seedConnection } from '../support/seed';
import { callTool, connectClient, seedConnectionWithSecret, type ToolResult } from './mcp-fixtures';

const RATE_LIMITED_CODE = 'rate_limited';

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

  it('admits the thirtieth send_message of a minute and refuses the next with rate_limited', async () => {
    const first = await seedConnectionWithSecret({ accountId: 'acc_out', agent: 'alpha' });
    const results = await sendMany({ secret: first.secret, count: OUTBOUND_MESSAGES_PER_MINUTE + 1 });
    expect(results.slice(0, OUTBOUND_MESSAGES_PER_MINUTE).every((result) => result.isError !== true)).toBe(true);
    const refused = results[OUTBOUND_MESSAGES_PER_MINUTE];
    expect(refused?.isError).toBe(true);
    expect(refused?.content[0]?.text).toContain(RATE_LIMITED_CODE);
  });

  it('counts per connection, so a second connection of the account still sends', async () => {
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
