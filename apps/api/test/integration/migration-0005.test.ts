import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import usageMigrationSql from '../../migrations/0003_usage.sql?raw';
import backofficeMigrationSql from '../../migrations/0005_backoffice.sql?raw';
import { applyDirectoryMigration, applyMigration, SEED_CREATED_AT } from '../support/seed';
import { testEnv } from '../support/workers-env';

type ColumnInfo = { name: string; notnull: number };
type OperatorRow = { id: number; last_totp_step: number; failed_attempts: number; locked_until: number | null };

const META_APP_ID = 'mapp_1';
const UNKNOWN_STATE = 'bogus';

async function columnOf(input: { table: string; column: string }): Promise<ColumnInfo | undefined> {
  const info = await testEnv.CONNECTIONS.prepare('SELECT name, "notnull" FROM pragma_table_info(?)').bind(input.table).all<ColumnInfo>();
  return info.results.find((candidate) => candidate.name === input.column);
}

function insertNumber(input: { state: string }) {
  return testEnv.CONNECTIONS.prepare(
    `INSERT INTO whatsapp_numbers
      (id, meta_app_ref, phone_number_id, waba_id, display_number, label, sealed_access_token, seal_key_version, state, created_at, updated_at)
     VALUES ('num_1', ?, '1000000000000001', '3000000000000003', '5511900000001', 'Main', 'sealed', 1, ?, ?, ?)`,
  ).bind(META_APP_ID, input.state, SEED_CREATED_AT, SEED_CREATED_AT);
}

afterEach(reset);

describe('migration 0005 on top of 0001 to 0004', () => {
  beforeEach(async () => {
    await applyDirectoryMigration();
    await applyMigration({ sql: usageMigrationSql });
    await applyMigration({ sql: backofficeMigrationSql });
    await testEnv.CONNECTIONS.prepare(
      "INSERT INTO meta_apps (id, meta_app_id, label, sealed_app_secret, seal_key_version, created_at, updated_at) VALUES (?, '2000000000000002', 'App', 'sealed', 1, ?, ?)",
    )
      .bind(META_APP_ID, SEED_CREATED_AT, SEED_CREATED_AT)
      .run();
  });

  it('seeds the operator row with no failures, no lock and no used step', async () => {
    const { results } = await testEnv.CONNECTIONS.prepare('SELECT * FROM backoffice_operator').all<OperatorRow>();
    expect(results).toEqual([{ id: 1, last_totp_step: 0, failed_attempts: 0, locked_until: null }]);
  });

  it('refuses a number state outside the four states', async () => {
    await expect(insertNumber({ state: UNKNOWN_STATE }).run()).rejects.toThrow();
  });

  it('accepts a pending number', async () => {
    await expect(insertNumber({ state: 'pending' }).run()).resolves.toMatchObject({ success: true });
  });

  it.each([
    ['whatsapp_numbers', 'verification_snapshot'],
    ['whatsapp_numbers', 'verified_at'],
    ['accounts', 'number_id'],
  ])('adds the nullable %s.%s column', async (table, column) => {
    expect(await columnOf({ table, column })).toMatchObject({ notnull: 0 });
  });
});
