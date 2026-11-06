import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import usageMigrationSql from '../../migrations/0003_usage.sql?raw';
import { generateConnectionSecret } from '../../src/adapters/platform/connection-secret';
import { McpToolName } from '../../src/contract/tool-definitions';
import { HttpStatus } from '../../src/routes/http-status';
import { applyDirectoryMigration, seedConnection } from '../support/seed';
import { accountInboxStub, testEnv } from '../support/workers-env';
import { callTool, connectClient, postMcp, seedConnectionWithSecret } from './mcp-fixtures';

const ACCOUNT_ID = 'acc_usage_security';
const REVOKED_AGENT = 'revoked';
const ACTIVE_AGENT = 'active';
const MALFORMED_SECRET = 'not-a-secret';
const HOLD_SECONDS = 1;

type ObjectUsage = { meterRows: { day: string; gigabyteSeconds: number }[]; alarm: number | null };

let activeClient: Client;
let revokedSecret: string;

function readObjectUsage(): Promise<ObjectUsage> {
  return runInDurableObject(accountInboxStub({ accountId: ACCOUNT_ID }), async (_instance, state) => ({
    meterRows: state.storage.sql
      .exec<{ day: string; gigabyteSeconds: number }>('SELECT day, gigabyte_seconds AS gigabyteSeconds FROM usage_meter')
      .toArray(),
    alarm: await state.storage.getAlarm(),
  }));
}

async function countDailyRows(): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM usage_daily').first<{ total: number }>();
  if (row === null) throw new Error('count query returned no row');
  return row.total;
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await testEnv.CONNECTIONS.prepare(usageMigrationSql).run();
  const activeConnection = await seedConnectionWithSecret({ accountId: ACCOUNT_ID, agent: ACTIVE_AGENT });
  revokedSecret = generateConnectionSecret();
  const revokedDigest = await seedConnection({ accountId: ACCOUNT_ID, agent: REVOKED_AGENT, secret: revokedSecret });
  await testEnv.CONNECTIONS.prepare('DELETE FROM connections WHERE secret_digest = ?').bind(revokedDigest).run();
  activeClient = await connectClient({ secret: activeConnection.secret });
  await callTool({ client: activeClient, name: McpToolName.WaitForReply, arguments: { timeout_seconds: HOLD_SECONDS } });
});
afterEach(reset);

describe('usage meter security', () => {
  it.each([
    { name: 'an unknown secret', secret: () => generateConnectionSecret() },
    { name: 'a revoked secret', secret: () => revokedSecret },
    { name: 'a malformed secret', secret: () => MALFORMED_SECRET },
  ])('does not count a request with $name', async ({ secret }) => {
    const usageBefore = await readObjectUsage();
    const response = await postMcp({ path: `/c/${secret()}/mcp` });
    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(await readObjectUsage()).toEqual(usageBefore);
    expect(await countDailyRows()).toBe(0);
  });
});
