import { AccountState, OwnerLocale } from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TOMBSTONE_STORAGE_KEY } from '../../src/account-inbox/constants';
import { clearExpiredInstallSecrets, sweepDeletingAccounts } from '../../src/accounts/deletion-sweep';
import { registerWithInstallCode } from '../support/install-codes';
import { applyDirectoryMigration, seedAccount, seedConnection, seedOwnerIdentity } from '../support/seed';
import { accountInboxStub, connectionOf, testEnv } from '../support/workers-env';

const FIRST_DELETING = 'acc_deleting_one';
const SECOND_DELETING = 'acc_deleting_two';
const SUSPENDED = 'acc_suspended';

function mediaKey(input: { accountId: string }): string {
  return `accounts/${input.accountId}/media/med_1`;
}

async function seedFullAccount(input: { accountId: string; state: AccountState; phone: string }) {
  await seedAccount({ accountId: input.accountId, state: input.state });
  await seedOwnerIdentity({ accountId: input.accountId, phone: input.phone, ownerLocale: OwnerLocale.PortugueseBrazil });
  await seedConnection({ accountId: input.accountId, agent: 'alpha', secret: `zb_conn_${input.accountId.padEnd(43, 'x').slice(0, 43)}` });
  await testEnv.MEDIA.put(mediaKey(input), new Uint8Array([1, 2, 3]));
  await accountInboxStub(input).sendText({
    connection: connectionOf({ accountId: input.accountId, agent: 'alpha' }),
    text: 'oi',
    replyToMessageId: null,
  });
}

function countRows(input: { table: string; accountId: string }): Promise<number> {
  const column = input.table === 'accounts' ? 'id' : 'account_id';
  return testEnv.CONNECTIONS.prepare(`SELECT COUNT(*) AS total FROM ${input.table} WHERE ${column} = ?`)
    .bind(input.accountId)
    .first<{ total: number }>()
    .then((row) => row!.total);
}

function storageKeys(input: { accountId: string }): Promise<string[]> {
  return runInDurableObject(accountInboxStub(input), async (_instance, state) => [...(await state.storage.list()).keys()]);
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedFullAccount({ accountId: FIRST_DELETING, state: AccountState.Deleting, phone: '5511900000001' });
  await seedFullAccount({ accountId: SECOND_DELETING, state: AccountState.Deleting, phone: '5511900000002' });
  await seedFullAccount({ accountId: SUSPENDED, state: AccountState.Suspended, phone: '5511900000003' });
});
afterEach(reset);

describe('sweepDeletingAccounts', () => {
  it('finishes every deleting account and leaves the suspended one untouched', async () => {
    await sweepDeletingAccounts({ environment: testEnv });
    const finished = [FIRST_DELETING, SECOND_DELETING];
    for (const accountId of finished) {
      expect(await countRows({ table: 'accounts', accountId })).toBe(0);
      expect(await countRows({ table: 'owner_identities', accountId })).toBe(0);
      expect(await countRows({ table: 'connections', accountId })).toBe(0);
      expect((await testEnv.MEDIA.list({ prefix: `accounts/${accountId}/` })).objects).toEqual([]);
      expect(await storageKeys({ accountId })).toEqual([TOMBSTONE_STORAGE_KEY]);
    }
    expect(await countRows({ table: 'accounts', accountId: SUSPENDED })).toBe(1);
    expect(await countRows({ table: 'connections', accountId: SUSPENDED })).toBe(1);
    expect((await testEnv.MEDIA.list({ prefix: `accounts/${SUSPENDED}/` })).objects).toHaveLength(1);
    expect(await storageKeys({ accountId: SUSPENDED })).not.toEqual([TOMBSTONE_STORAGE_KEY]);
  });

  it('finishes an account whose object was already purged by an interrupted run', async () => {
    await accountInboxStub({ accountId: FIRST_DELETING }).purge();
    await sweepDeletingAccounts({ environment: testEnv });
    expect(await countRows({ table: 'accounts', accountId: FIRST_DELETING })).toBe(0);
    expect(await storageKeys({ accountId: FIRST_DELETING })).toEqual([TOMBSTONE_STORAGE_KEY]);
  });

  it('succeeds when run twice', async () => {
    await sweepDeletingAccounts({ environment: testEnv });
    await expect(sweepDeletingAccounts({ environment: testEnv })).resolves.toBeUndefined();
    expect(await countRows({ table: 'accounts', accountId: SUSPENDED })).toBe(1);
  });
});

describe('clearExpiredInstallSecrets', () => {
  const EXPIRY = 1_000;

  function sealedSecretOf(input: { connectionId: string }): Promise<string | null> {
    return testEnv.CONNECTIONS.prepare('SELECT install_code_sealed_secret AS sealed FROM connections WHERE id = ?')
      .bind(input.connectionId)
      .first<{ sealed: string | null }>()
      .then((row) => row!.sealed);
  }

  it('clears only the sealed secrets whose code expired, at the expiry instant included', async () => {
    const expired = await registerWithInstallCode({ accountId: SUSPENDED, agent: 'expired', expiresAt: EXPIRY });
    const live = await registerWithInstallCode({ accountId: SUSPENDED, agent: 'live', expiresAt: EXPIRY + 1 });
    await clearExpiredInstallSecrets({ environment: testEnv, now: EXPIRY });
    expect(await sealedSecretOf(expired.connection)).toBeNull();
    expect(await sealedSecretOf(live.connection)).not.toBeNull();
  });

  it('keeps the digest of an expired code so the page can still say it expired', async () => {
    const expired = await registerWithInstallCode({ accountId: SUSPENDED, agent: 'expired', expiresAt: EXPIRY });
    await clearExpiredInstallSecrets({ environment: testEnv, now: EXPIRY });
    const row = await testEnv.CONNECTIONS.prepare('SELECT install_code_digest AS digest FROM connections WHERE id = ?')
      .bind(expired.connection.connectionId)
      .first<{ digest: string | null }>();
    expect(row!.digest).toBe(expired.connection.installCodeDigest);
  });
});
