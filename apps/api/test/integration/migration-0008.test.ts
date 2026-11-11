import { META_APP_ID } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import usageMigrationSql from '../../migrations/0003_usage.sql?raw';
import metaOnboardingMigrationSql from '../../migrations/0008_meta_onboarding.sql?raw';
import { accessTokenAssociatedData } from '../../src/numbers/number-sealing';
import {
  applyAccountsMigration,
  applyActivityMigration,
  applyBackofficeFlashMigration,
  applyBackofficeMigration,
  applyChannelMigration,
  applyCoreMigration,
  applyMigration,
  SEED_CREATED_AT,
} from '../support/seed';
import { testSecretBox } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';

type ColumnInfo = { name: string; notnull: number };
type NumberRow = { id: string; sealed_access_token: string; display_number: string };
type TableName = { name: string };

const META_APP_REF = 'mapp_1';
const FOREIGN_META_APP_ID = '999';
const NUMBER_ID = 'num_1';
const ACCOUNT_ID = 'acc_1';
const ACCESS_TOKEN = 'migrated-access-token';
const DISPLAY_NUMBER = '+5511900000001';

async function columnOf(input: { table: string; column: string }): Promise<ColumnInfo | undefined> {
  const info = await testEnv.CONNECTIONS.prepare('SELECT name, "notnull" FROM pragma_table_info(?)').bind(input.table).all<ColumnInfo>();
  return info.results.find((candidate) => candidate.name === input.column);
}

async function tableNames(): Promise<string[]> {
  const { results } = await testEnv.CONNECTIONS.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'index')").all<TableName>();
  return results.map((row) => row.name);
}

function insertMetaApp(input: { ref: string; metaAppId: string }) {
  return testEnv.CONNECTIONS.prepare(
    "INSERT INTO meta_apps (id, meta_app_id, label, sealed_app_secret, seal_key_version, created_at, updated_at) VALUES (?, ?, 'App', 'sealed', 1, ?, ?)",
  ).bind(input.ref, input.metaAppId, SEED_CREATED_AT, SEED_CREATED_AT);
}

async function insertNumber(): Promise<void> {
  const sealedAccessToken = await testSecretBox().seal({
    plain: ACCESS_TOKEN,
    associatedData: accessTokenAssociatedData({ numberId: NUMBER_ID }),
  });
  await testEnv.CONNECTIONS.batch([
    testEnv.CONNECTIONS.prepare(
      `INSERT INTO whatsapp_numbers
        (id, meta_app_ref, phone_number_id, waba_id, display_number, label, sealed_access_token, seal_key_version, state, credentials_changed_at, created_at, updated_at)
       VALUES (?, ?, '1000000000000001', '3000000000000003', ?, 'Main', ?, 1, 'active', ?, ?, ?)`,
    ).bind(NUMBER_ID, META_APP_REF, DISPLAY_NUMBER, sealedAccessToken, SEED_CREATED_AT, SEED_CREATED_AT, SEED_CREATED_AT),
    testEnv.CONNECTIONS.prepare('INSERT INTO accounts (id, state, created_at, number_id) VALUES (?, ?, ?, ?)').bind(
      ACCOUNT_ID,
      'active',
      SEED_CREATED_AT,
      NUMBER_ID,
    ),
  ]);
}

afterEach(reset);

describe('migration 0008 on top of 0001 to 0007', () => {
  beforeEach(async () => {
    await applyCoreMigration();
    await applyAccountsMigration();
    await applyMigration({ sql: usageMigrationSql });
    await applyChannelMigration();
    await applyBackofficeMigration();
    await applyBackofficeFlashMigration();
    await applyActivityMigration();
  });

  describe('with a number of the fixed app', () => {
    beforeEach(async () => {
      await insertMetaApp({ ref: META_APP_REF, metaAppId: META_APP_ID }).run();
      await insertNumber();
      await applyMigration({ sql: metaOnboardingMigrationSql });
    });

    it('copies the number without meta_app_ref and drops meta_apps', async () => {
      const { results } = await testEnv.CONNECTIONS.prepare(
        'SELECT id, sealed_access_token, display_number FROM whatsapp_numbers',
      ).all<NumberRow>();
      expect(results.map((row) => [row.id, row.display_number])).toEqual([[NUMBER_ID, DISPLAY_NUMBER]]);
      expect(await columnOf({ table: 'whatsapp_numbers', column: 'meta_app_ref' })).toBeUndefined();
      expect(await tableNames()).not.toContain('meta_apps');
    });

    it('keeps the sealed access token openable', async () => {
      const row = await testEnv.CONNECTIONS.prepare('SELECT sealed_access_token FROM whatsapp_numbers WHERE id = ?')
        .bind(NUMBER_ID)
        .first<{ sealed_access_token: string }>();
      const opened = await testSecretBox().open({
        sealed: row!.sealed_access_token,
        associatedData: accessTokenAssociatedData({ numberId: NUMBER_ID }),
      });
      expect(opened).toBe(ACCESS_TOKEN);
    });

    it('keeps the account bound to the number', async () => {
      const row = await testEnv.CONNECTIONS.prepare('SELECT number_id FROM accounts WHERE id = ?')
        .bind(ACCOUNT_ID)
        .first<{ number_id: string }>();
      expect(row).toEqual({ number_id: NUMBER_ID });
    });

    it('recreates the waba index and keeps the foreign key from accounts', async () => {
      expect(await tableNames()).toContain('whatsapp_numbers_waba');
      const { results } = await testEnv.CONNECTIONS.prepare('SELECT "table" AS name FROM pragma_foreign_key_list(?)')
        .bind('accounts')
        .all<TableName>();
      expect(results.map((row) => row.name)).toContain('whatsapp_numbers');
    });

    it('adds the nullable onboarding grant column to the sessions', async () => {
      expect(await columnOf({ table: 'backoffice_sessions', column: 'onboarding_grant_until' })).toMatchObject({ notnull: 0 });
    });
  });

  it('refuses a foreign app and leaves meta_apps and whatsapp_numbers unchanged', async () => {
    await insertMetaApp({ ref: META_APP_REF, metaAppId: META_APP_ID }).run();
    await insertMetaApp({ ref: 'mapp_2', metaAppId: FOREIGN_META_APP_ID }).run();
    await insertNumber();
    await expect(applyMigration({ sql: metaOnboardingMigrationSql })).rejects.toThrow();
    expect(await tableNames()).toContain('meta_apps');
    expect(await tableNames()).not.toContain('whatsapp_numbers_next');
    expect(await columnOf({ table: 'whatsapp_numbers', column: 'meta_app_ref' })).toMatchObject({ notnull: 1 });
    const { results } = await testEnv.CONNECTIONS.prepare('SELECT id FROM whatsapp_numbers').all<{ id: string }>();
    expect(results).toEqual([{ id: NUMBER_ID }]);
  });
});
