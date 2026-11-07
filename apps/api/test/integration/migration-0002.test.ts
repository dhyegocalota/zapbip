import { AccountState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import {
  applyAccountsMigration,
  applyCoreMigration,
  applyDirectoryMigration,
  SEED_CREATED_AT,
  seedAccount,
  seedConnection,
} from '../support/seed';
import { testEnv } from '../support/workers-env';

type ColumnInfo = { name: string };

const SECRET = `zb_conn_${'C'.repeat(43)}`;
const OTHER_SECRET = `zb_conn_${'D'.repeat(43)}`;
const UNKNOWN_STATE = 'banned' as AccountState;
const EXPECTED_COLUMNS: Record<string, string[]> = {
  accounts: ['id', 'state', 'created_at'],
  owner_identities: ['wa_id', 'account_id', 'from_user_id', 'locale', 'created_at'],
  connections: [
    'id',
    'account_id',
    'agent',
    'secret_digest',
    'client_name',
    'install_code_digest',
    'install_code_sealed_secret',
    'install_code_expires_at',
    'first_call_at',
    'created_at',
    'rotated_at',
    'revoked_at',
  ],
  message_index: ['wamid', 'account_id', 'created_at'],
  blocked_phones: ['wa_id', 'reason', 'created_at'],
};

async function columnsOf(input: { table: string }): Promise<string[]> {
  const info = await testEnv.CONNECTIONS.prepare(`SELECT name FROM pragma_table_info(?)`).bind(input.table).all<ColumnInfo>();
  return info.results.map((column) => column.name);
}

afterEach(reset);

describe('migration 0002 on a database that holds 0001 rows', () => {
  beforeEach(async () => {
    await applyCoreMigration();
    await testEnv.CONNECTIONS.batch([
      testEnv.CONNECTIONS.prepare('INSERT INTO accounts (id, created_at) VALUES (?, ?)').bind('acc_1', SEED_CREATED_AT),
      testEnv.CONNECTIONS.prepare('INSERT INTO message_index (wamid, account_id, created_at) VALUES (?, ?, ?)').bind(
        'wamid_1',
        'acc_1',
        SEED_CREATED_AT,
      ),
    ]);
  });

  it('[row 280] pin applies without a foreign key error and creates the spec tables', async () => {
    await applyAccountsMigration();
    const tables = await Promise.all(Object.keys(EXPECTED_COLUMNS).map(async (table) => [table, await columnsOf({ table })] as const));
    expect(Object.fromEntries(tables)).toEqual(EXPECTED_COLUMNS);
  });
});

describe('migration 0002 schema', () => {
  beforeEach(applyDirectoryMigration);

  it('pin refuses an account state outside the four states', async () => {
    await expect(seedAccount({ accountId: 'acc_1', state: UNKNOWN_STATE })).rejects.toThrow(/CHECK/);
  });

  it('pin refuses two active rows with the same account and agent', async () => {
    await seedConnection({ accountId: 'acc_1', agent: 'alpha', secret: SECRET });
    await expect(seedConnection({ accountId: 'acc_1', agent: 'alpha', secret: OTHER_SECRET })).rejects.toThrow(/UNIQUE/);
  });

  it('pin accepts a revoked row and an active row with the same account and agent', async () => {
    await seedConnection({ accountId: 'acc_1', agent: 'alpha', secret: SECRET, revokedAt: SEED_CREATED_AT });
    await seedConnection({ accountId: 'acc_1', agent: 'alpha', secret: OTHER_SECRET });
    const rows = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM connections').first<{ total: number }>();
    expect(rows?.total).toBe(2);
  });

  it('pin refuses two rows with the same digest', async () => {
    await seedConnection({ accountId: 'acc_1', agent: 'alpha', secret: SECRET });
    await expect(seedConnection({ accountId: 'acc_1', agent: 'beta', secret: SECRET })).rejects.toThrow(/UNIQUE/);
  });

  it('refuses two rows with the same install code digest', async () => {
    const statement =
      'INSERT INTO connections (id, account_id, agent, secret_digest, install_code_digest, created_at) VALUES (?, ?, ?, ?, ?, ?)';
    await seedAccount({ accountId: 'acc_1' });
    await testEnv.CONNECTIONS.prepare(statement).bind('con_1', 'acc_1', 'alpha', 'digest_one', 'install_digest', SEED_CREATED_AT).run();
    await expect(
      testEnv.CONNECTIONS.prepare(statement).bind('con_2', 'acc_1', 'beta', 'digest_two', 'install_digest', SEED_CREATED_AT).run(),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('pin refuses a connection whose account does not exist', async () => {
    await expect(
      testEnv.CONNECTIONS.prepare('INSERT INTO connections (id, account_id, agent, secret_digest, created_at) VALUES (?, ?, ?, ?, ?)')
        .bind('con_1', 'acc_missing', 'alpha', 'digest', SEED_CREATED_AT)
        .run(),
    ).rejects.toThrow(/FOREIGN KEY/);
  });
});
