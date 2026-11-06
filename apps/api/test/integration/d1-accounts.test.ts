import { AccountState, OwnerLocale } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { D1AccountDirectory } from '../../src/adapters/d1/d1-account-directory';
import { applyDirectoryMigration, SEED_CREATED_AT, seedAccount, seedConnection, seedOwnerIdentity } from '../support/seed';
import { testEnv } from '../support/workers-env';

const WA_ID = '5511900000000';
const OTHER_WA_ID = '5511900000001';
const CREATED_AT = 1_000;
const CAP_LIMIT = 50;
const CAP_SINCE = 500;
const CONCURRENT_CALLS = 20;
const SECRET = `zb_conn_${'E'.repeat(43)}`;
const OTHER_SECRET = `zb_conn_${'F'.repeat(43)}`;

function directory(): D1AccountDirectory {
  return new D1AccountDirectory({ database: testEnv.CONNECTIONS });
}

function create(input: { waId: string; accountId: string; since?: number; initialState?: AccountState }) {
  const { since = CAP_SINCE, initialState = AccountState.Waitlisted } = input;
  return directory().findOrCreateByWaId({
    waId: input.waId,
    accountId: input.accountId,
    initialState,
    locale: OwnerLocale.PortugueseBrazil,
    createdAt: CREATED_AT,
    newAccountsCap: { since, limit: CAP_LIMIT },
  });
}

async function countRows(input: { table: string }): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare(`SELECT COUNT(*) AS total FROM ${input.table}`).first<{ total: number }>();
  if (row === null) throw new Error('count missing');
  return row.total;
}

async function seedRecentAccounts(input: { count: number; createdAt: number }): Promise<void> {
  const statements = Array.from({ length: input.count }, (_, index) =>
    testEnv.CONNECTIONS.prepare('INSERT INTO accounts (id, state, created_at) VALUES (?, ?, ?)').bind(
      `acc_seed_${index}`,
      AccountState.Active,
      input.createdAt,
    ),
  );
  await testEnv.CONNECTIONS.batch(statements);
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('D1 account directory', () => {
  it('creates the account and its owner identity', async () => {
    expect(await create({ waId: WA_ID, accountId: 'acc_1' })).toEqual({
      account: { accountId: 'acc_1', waId: WA_ID, state: AccountState.Waitlisted, locale: OwnerLocale.PortugueseBrazil },
      created: true,
    });
    expect(await countRows({ table: 'accounts' })).toBe(1);
    expect(await countRows({ table: 'owner_identities' })).toBe(1);
  });

  it('returns the existing account for the same wa_id without a new row', async () => {
    await create({ waId: WA_ID, accountId: 'acc_1' });
    const second = await create({ waId: WA_ID, accountId: 'acc_2' });
    expect(second?.created).toBe(false);
    expect(second?.account.accountId).toBe('acc_1');
    expect(await countRows({ table: 'accounts' })).toBe(1);
    expect(await countRows({ table: 'owner_identities' })).toBe(1);
  });

  it('resolves concurrent first messages from one phone to one account', async () => {
    const lookups = await Promise.all(
      Array.from({ length: CONCURRENT_CALLS }, (_, index) => create({ waId: WA_ID, accountId: `acc_${index}` })),
    );
    expect(new Set(lookups.map((lookup) => lookup?.account.accountId)).size).toBe(1);
    expect(await countRows({ table: 'accounts' })).toBe(1);
    expect(await countRows({ table: 'owner_identities' })).toBe(1);
  });

  it('returns null and writes nothing when the daily cap is reached', async () => {
    await seedRecentAccounts({ count: CAP_LIMIT, createdAt: CAP_SINCE + 1 });
    expect(await create({ waId: WA_ID, accountId: 'acc_new' })).toBeNull();
    expect(await countRows({ table: 'accounts' })).toBe(CAP_LIMIT);
    expect(await countRows({ table: 'owner_identities' })).toBe(0);
  });

  it('creates the account when the capped accounts are older than the window', async () => {
    await seedRecentAccounts({ count: CAP_LIMIT, createdAt: CAP_SINCE });
    expect((await create({ waId: WA_ID, accountId: 'acc_new' }))?.created).toBe(true);
  });

  it('returns an existing owner while the daily cap is reached', async () => {
    await create({ waId: WA_ID, accountId: 'acc_1' });
    await seedRecentAccounts({ count: CAP_LIMIT, createdAt: CAP_SINCE + 1 });
    expect((await create({ waId: WA_ID, accountId: 'acc_2' }))?.created).toBe(false);
  });

  it('finds no account for an unknown wa_id', async () => {
    expect(await directory().findByWaId({ waId: WA_ID })).toBeNull();
  });

  it('sets the state of an account', async () => {
    await create({ waId: WA_ID, accountId: 'acc_1' });
    await directory().setState({ accountId: 'acc_1', state: AccountState.Suspended });
    expect((await directory().findByWaId({ waId: WA_ID }))?.state).toBe(AccountState.Suspended);
  });

  it('lists the accounts of one state only', async () => {
    await create({ waId: WA_ID, accountId: 'acc_1', initialState: AccountState.Deleting });
    await create({ waId: OTHER_WA_ID, accountId: 'acc_2', initialState: AccountState.Suspended });
    expect(await directory().listByState({ state: AccountState.Deleting })).toEqual([
      { accountId: 'acc_1', waId: WA_ID, state: AccountState.Deleting, locale: OwnerLocale.PortugueseBrazil },
    ]);
  });
});

describe('D1 account directory remove', () => {
  beforeEach(async () => {
    await seedOwnerIdentity({ accountId: 'acc_1', phone: WA_ID, ownerLocale: OwnerLocale.PortugueseBrazil });
    await seedConnection({ accountId: 'acc_1', agent: 'alpha', secret: SECRET });
    await seedConnection({ accountId: 'acc_1', agent: 'beta', secret: OTHER_SECRET });
    await seedAccount({ accountId: 'acc_2' });
    await testEnv.CONNECTIONS.batch(
      ['wamid_1', 'wamid_2', 'wamid_3'].map((wamid, index) =>
        testEnv.CONNECTIONS.prepare('INSERT INTO message_index (wamid, account_id, created_at) VALUES (?, ?, ?)').bind(
          wamid,
          index === 2 ? 'acc_2' : 'acc_1',
          SEED_CREATED_AT,
        ),
      ),
    );
  });

  it('removes every row of the account and no row of another account', async () => {
    await directory().remove({ accountId: 'acc_1' });
    expect(await countRows({ table: 'owner_identities' })).toBe(0);
    expect(await countRows({ table: 'connections' })).toBe(0);
    expect(await countRows({ table: 'message_index' })).toBe(1);
    expect(await countRows({ table: 'accounts' })).toBe(1);
  });

  it('removes nothing when a statement of the batch fails', async () => {
    await testEnv.CONNECTIONS.prepare(
      "CREATE TRIGGER fail_connections_delete BEFORE DELETE ON connections BEGIN SELECT RAISE(ABORT, 'forced failure'); END",
    ).run();
    await expect(directory().remove({ accountId: 'acc_1' })).rejects.toThrow(/forced failure/);
    expect(await countRows({ table: 'message_index' })).toBe(3);
    expect(await countRows({ table: 'owner_identities' })).toBe(1);
    expect(await countRows({ table: 'connections' })).toBe(2);
    expect(await countRows({ table: 'accounts' })).toBe(2);
  });

  it('finishes quietly when the account is already gone', async () => {
    await directory().remove({ accountId: 'acc_1' });
    await expect(directory().remove({ accountId: 'acc_1' })).resolves.toBeUndefined();
  });
});
