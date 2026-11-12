import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import usageMigrationSql from '../../migrations/0003_usage.sql?raw';
import {
  applyAccountsMigration,
  applyActivityMigration,
  applyBackofficeFlashMigration,
  applyBackofficeMigration,
  applyChannelMigration,
  applyCoreMigration,
  applyMetaOnboardingMigration,
  applyMigration,
  applyPasswordSignInMigration,
} from '../support/seed';
import { testEnv } from '../support/workers-env';

type ColumnInfo = { name: string; notnull: number };
type IndexInfo = { name: string; unique: number };
type OperatorRow = {
  last_totp_step: number;
  failed_attempts: number;
  locked_until: number | null;
  email: string | null;
  password_hash: string | null;
};

const LAST_TOTP_STEP = 55;
const FAILED_ATTEMPTS = 3;
const LOCKED_UNTIL = 1_700_000_900_000;
const SESSION_DIGEST = 'session-digest';
const SESSION_AT = 1_700_000_000_000;
const EMAIL_INDEX = 'backoffice_operator_email';
const PENDING_TABLE = 'backoffice_pending_sign_ins';

async function columnsOf(input: { table: string }): Promise<ColumnInfo[]> {
  const info = await testEnv.CONNECTIONS.prepare('SELECT name, "notnull" FROM pragma_table_info(?)').bind(input.table).all<ColumnInfo>();
  return info.results;
}

afterEach(reset);

describe('migration 0009 on top of 0001 to 0008', () => {
  beforeEach(async () => {
    await applyCoreMigration();
    await applyAccountsMigration();
    await applyMigration({ sql: usageMigrationSql });
    await applyChannelMigration();
    await applyBackofficeMigration();
    await applyBackofficeFlashMigration();
    await applyActivityMigration();
    await applyMetaOnboardingMigration();
    await testEnv.CONNECTIONS.batch([
      testEnv.CONNECTIONS.prepare(
        'UPDATE backoffice_operator SET last_totp_step = ?, failed_attempts = ?, locked_until = ? WHERE id = 1',
      ).bind(LAST_TOTP_STEP, FAILED_ATTEMPTS, LOCKED_UNTIL),
      testEnv.CONNECTIONS.prepare(
        'INSERT INTO backoffice_sessions (token_digest, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?)',
      ).bind(SESSION_DIGEST, SESSION_AT, SESSION_AT, SESSION_AT),
    ]);
    await applyPasswordSignInMigration();
  });

  it('ends every session', async () => {
    const { results } = await testEnv.CONNECTIONS.prepare('SELECT token_digest FROM backoffice_sessions').all();
    expect(results).toEqual([]);
  });

  it('keeps the counters and leaves the email and the hash empty', async () => {
    const row = await testEnv.CONNECTIONS.prepare(
      'SELECT last_totp_step, failed_attempts, locked_until, email, password_hash FROM backoffice_operator WHERE id = 1',
    ).first<OperatorRow>();
    expect(row).toEqual({
      last_totp_step: LAST_TOTP_STEP,
      failed_attempts: FAILED_ATTEMPTS,
      locked_until: LOCKED_UNTIL,
      email: null,
      password_hash: null,
    });
  });

  it('adds the separate password-step counter and lock', async () => {
    const columns = await columnsOf({ table: 'backoffice_operator' });
    expect(columns.filter((column) => column.name.startsWith('password_')).map((column) => [column.name, column.notnull])).toEqual([
      ['password_hash', 0],
      ['password_failed_attempts', 1],
      ['password_locked_until', 0],
    ]);
  });

  it('makes the email unique', async () => {
    const { results } = await testEnv.CONNECTIONS.prepare('SELECT name, "unique" AS "unique" FROM pragma_index_list(?)')
      .bind('backoffice_operator')
      .all<IndexInfo>();
    expect(results).toContainEqual({ name: EMAIL_INDEX, unique: 1 });
  });

  it('creates the pending sign-in table with its three columns', async () => {
    const columns = await columnsOf({ table: PENDING_TABLE });
    expect(columns.map((column) => column.name)).toEqual(['token_digest', 'created_at', 'expires_at']);
  });
});
