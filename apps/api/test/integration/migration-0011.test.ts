import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyDirectoryMigration } from '../support/seed';
import { testEnv } from '../support/workers-env';

const INSERT_TOKEN_STATEMENT =
  'INSERT INTO client_app_sign_in_tokens (token_digest, account_id, created_at, expires_at) VALUES (?, ?, 1, 2)';
const INSERT_SESSION_STATEMENT = 'INSERT INTO client_app_sessions (session_digest, account_id, created_at, expires_at) VALUES (?, ?, 1, 2)';
const TABLE_NAMES_STATEMENT = "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'client_app_%' ORDER BY name";

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('migration 0011', () => {
  it('adds the two tables of the customer web app', async () => {
    const tables = await testEnv.CONNECTIONS.prepare(TABLE_NAMES_STATEMENT).all<{ name: string }>();
    expect(tables.results.map((row) => row.name)).toEqual(['client_app_sessions', 'client_app_sign_in_tokens']);
  });

  it('refuses a second live token for one account', async () => {
    await testEnv.CONNECTIONS.prepare(INSERT_TOKEN_STATEMENT).bind('digest-one', 'acc_one').run();
    await expect(testEnv.CONNECTIONS.prepare(INSERT_TOKEN_STATEMENT).bind('digest-two', 'acc_one').run()).rejects.toThrow();
  });

  it('refuses a repeated session digest', async () => {
    await testEnv.CONNECTIONS.prepare(INSERT_SESSION_STATEMENT).bind('digest-one', 'acc_one').run();
    await expect(testEnv.CONNECTIONS.prepare(INSERT_SESSION_STATEMENT).bind('digest-one', 'acc_two').run()).rejects.toThrow();
  });
});
