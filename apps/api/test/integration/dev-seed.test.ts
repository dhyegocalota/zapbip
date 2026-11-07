import { InboxErrorCode, OwnerLocale } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { hashConnectionSecret } from '../../src/adapters/platform/hash';
import { CONNECTION_SECRET_PATTERN } from '../../src/contract/constants';
import { assertOwnerAbsent, buildDirectorySeed, findOwnerStatement } from '../../src/dev/build-directory-seed';
import { applyDirectoryMigration, SEED_CREATED_AT } from '../support/seed';
import { testEnv } from '../support/workers-env';

const PHONE = '5511999990000';
const AGENTS = ['claude-code', 'codex'];

async function runSeed(input: { phone: string; agents: string[] }) {
  const owner = await testEnv.CONNECTIONS.prepare(findOwnerStatement({ phone: input.phone })).first<{ total: number }>();
  if (owner === null) throw new Error('owner count missing');
  assertOwnerAbsent({ existingCount: owner.total });
  const seed = await buildDirectorySeed({ ...input, createdAt: SEED_CREATED_AT });
  await testEnv.CONNECTIONS.batch(seed.statements.map((statement) => testEnv.CONNECTIONS.prepare(statement)));
  return seed;
}

async function countRows(input: { table: string }): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM ' + input.table).first<{ total: number }>();
  if (row === null) throw new Error('count missing');
  return row.total;
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('dev seed', () => {
  it('seeds one connection per agent and the owner identity', async () => {
    const seed = await runSeed({ phone: PHONE, agents: AGENTS });
    const connections = await testEnv.CONNECTIONS.prepare('SELECT agent, secret_digest FROM connections ORDER BY agent').all<{
      agent: string;
      secret_digest: string;
    }>();
    const owner = await testEnv.CONNECTIONS.prepare('SELECT account_id, locale FROM owner_identities WHERE wa_id = ?')
      .bind(PHONE)
      .first<{ account_id: string; locale: string }>();
    expect(seed.connections.map((connection) => connection.agent)).toEqual(AGENTS);
    expect(seed.connections.every((connection) => CONNECTION_SECRET_PATTERN.test(connection.secret))).toBe(true);
    expect(connections.results).toEqual(
      await Promise.all(
        seed.connections.map(async (connection) => ({
          agent: connection.agent,
          secret_digest: await hashConnectionSecret({ secret: connection.secret }),
        })),
      ),
    );
    expect(owner?.locale).toBe(OwnerLocale.PortugueseBrazil);
  });

  it('refuses a second run with the same phone and writes nothing', async () => {
    await runSeed({ phone: PHONE, agents: AGENTS });
    const connectionsBefore = await countRows({ table: 'connections' });
    await expect(runSeed({ phone: PHONE, agents: ['third'] })).rejects.toMatchObject({ code: InboxErrorCode.InvalidInput });
    expect(await countRows({ table: 'connections' })).toBe(connectionsBefore);
    expect(await countRows({ table: 'accounts' })).toBe(1);
  });

  it.each([
    ['a phone with letters', { phone: '55abc', agents: AGENTS }],
    ['an agent name with uppercase', { phone: PHONE, agents: ['Alpha'] }],
    ['a repeated agent', { phone: PHONE, agents: ['alpha', 'alpha'] }],
    ['no agents', { phone: PHONE, agents: [] }],
  ])('rejects %s', async (_name, input) => {
    await expect(runSeed(input)).rejects.toMatchObject({ code: InboxErrorCode.InvalidInput });
    expect(await countRows({ table: 'accounts' })).toBe(0);
  });
});
