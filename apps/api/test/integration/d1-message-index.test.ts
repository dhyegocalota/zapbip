import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { D1MessageIndex } from '../../src/adapters/d1/d1-message-index';
import { applyDirectoryMigration, seedAccount, SEED_CREATED_AT } from '../support/seed';
import { testEnv } from '../support/workers-env';

const ACCOUNT_ID = 'acc_1';
const WAMID = 'wamid.1';

function index(): D1MessageIndex {
  return new D1MessageIndex({ database: testEnv.CONNECTIONS });
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedAccount({ accountId: ACCOUNT_ID });
});
afterEach(reset);

describe('D1 message index', () => {
  it('WI-7 records an id once', async () => {
    expect(await index().record({ id: WAMID, accountId: ACCOUNT_ID, at: SEED_CREATED_AT })).toBe(true);
    expect(await index().record({ id: WAMID, accountId: ACCOUNT_ID, at: SEED_CREATED_AT })).toBe(false);
    expect(await index().find({ id: WAMID })).toEqual({ accountId: ACCOUNT_ID });
  });

  it('WI-7 keeps the first account when the same id is recorded for another', async () => {
    await seedAccount({ accountId: 'acc_2' });
    await index().record({ id: WAMID, accountId: ACCOUNT_ID, at: SEED_CREATED_AT });
    expect(await index().record({ id: WAMID, accountId: 'acc_2', at: SEED_CREATED_AT })).toBe(false);
    expect(await index().find({ id: WAMID })).toEqual({ accountId: ACCOUNT_ID });
  });

  it('WI-8 finds nothing for an unknown id', async () => {
    expect(await index().find({ id: 'wamid.none' })).toBeNull();
  });
});
