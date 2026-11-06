import { AccountState, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { AccountLifecycleDependencies } from '../ports';
import { createInMemoryAccountDependencies } from '../testing/in-memory-accounts';
import { addAgent, BRAZIL_WA_ID } from '../testing/fixtures';
import { finishAccountDeletion } from './finish-account-deletion';
import { finishDeletingAccounts } from './finish-deleting-accounts';
import { openOwnerAccount } from './open-owner-account';
import { resumeSuspendedAccount } from './resume-suspended-account';

async function setup() {
  const environment = createInMemoryAccountDependencies();
  const account = await environment.openAccount({ waId: BRAZIL_WA_ID, state: AccountState.Active, locale: OwnerLocale.PortugueseBrazil });
  await addAgent({ environment, account, agent: 'claude' });
  environment.accountMedia.put({ accountId: account.accountId, mediaId: 'med_1' });
  const calls: string[] = [];
  const dependencies: AccountLifecycleDependencies = {
    accounts: {
      ...environment.directory,
      setState: async (input) => {
        calls.push(`state:${input.state}`);
        await environment.directory.setState(input);
      },
      remove: async (input) => {
        calls.push('remove');
        await environment.directory.remove(input);
      },
    },
    accountMedia: {
      deleteAll: async (input) => {
        calls.push('media');
        await environment.accountMedia.deleteAll(input);
      },
    },
    ids: environment.dependencies.ids,
  };
  const inboxPurge = {
    purge: async () => {
      calls.push('purge');
    },
  };
  return { environment, account, dependencies, inboxPurge, calls };
}

describe('finishAccountDeletion', () => {
  test('runs the steps in order and leaves nothing behind', async () => {
    const { environment, account, dependencies, inboxPurge, calls } = await setup();
    await finishAccountDeletion({ dependencies, accountId: account.accountId, inboxPurge });
    expect(calls).toEqual([`state:${AccountState.Deleting}`, 'purge', 'media', 'remove']);
    expect(await environment.directory.findByWaId({ waId: BRAZIL_WA_ID })).toBeNull();
    expect(environment.registry.listAll({ accountId: account.accountId })).toEqual([]);
    expect(environment.accountMedia.count({ accountId: account.accountId })).toBe(0);
  });

  test('a failed purge leaves the account deleting and the next call completes', async () => {
    const { environment, account, dependencies } = await setup();
    let shouldFail = true;
    const inboxPurge = {
      purge: async () => {
        if (!shouldFail) return;
        shouldFail = false;
        throw new Error('purge failed');
      },
    };
    await expect(finishAccountDeletion({ dependencies, accountId: account.accountId, inboxPurge })).rejects.toThrow('purge failed');
    expect((await environment.directory.findByWaId({ waId: BRAZIL_WA_ID }))!.state).toBe(AccountState.Deleting);
    await finishAccountDeletion({ dependencies, accountId: account.accountId, inboxPurge });
    expect(await environment.directory.findByWaId({ waId: BRAZIL_WA_ID })).toBeNull();
  });

  test('a failed media purge leaves the account deleting and the next call completes', async () => {
    const { environment, account, dependencies, inboxPurge } = await setup();
    let shouldFail = true;
    const failing: AccountLifecycleDependencies = {
      ...dependencies,
      accountMedia: {
        deleteAll: async (input) => {
          if (shouldFail) {
            shouldFail = false;
            throw new Error('media failed');
          }
          await environment.accountMedia.deleteAll(input);
        },
      },
    };
    await expect(finishAccountDeletion({ dependencies: failing, accountId: account.accountId, inboxPurge })).rejects.toThrow(
      'media failed',
    );
    expect((await environment.directory.findByWaId({ waId: BRAZIL_WA_ID }))!.state).toBe(AccountState.Deleting);
    await finishAccountDeletion({ dependencies: failing, accountId: account.accountId, inboxPurge });
    expect(environment.accountMedia.count({ accountId: account.accountId })).toBe(0);
  });

  test('a second call on a completed deletion succeeds', async () => {
    const { account, dependencies, inboxPurge } = await setup();
    await finishAccountDeletion({ dependencies, accountId: account.accountId, inboxPurge });
    await expect(finishAccountDeletion({ dependencies, accountId: account.accountId, inboxPurge })).resolves.toBeUndefined();
  });

  test('another account is untouched', async () => {
    const { environment, account, dependencies, inboxPurge } = await setup();
    const other = await environment.openAccount({ waId: '5521988887777', accountId: 'account_other' });
    await addAgent({ environment, account: other, agent: 'codex' });
    environment.accountMedia.put({ accountId: other.accountId, mediaId: 'med_2' });
    await finishAccountDeletion({ dependencies, accountId: account.accountId, inboxPurge });
    expect(await environment.registry.listActive({ accountId: other.accountId })).toHaveLength(1);
    expect(environment.accountMedia.count({ accountId: other.accountId })).toBe(1);
  });

  test('the same number opens a new account afterwards', async () => {
    const { environment, account, dependencies, inboxPurge } = await setup();
    await finishAccountDeletion({ dependencies, accountId: account.accountId, inboxPurge });
    const reopened = await openOwnerAccount({
      dependencies: environment.lifecycle,
      waId: BRAZIL_WA_ID,
      waitlistEnabled: true,
      createdAt: 1,
    });
    expect(reopened).toMatchObject({ waId: BRAZIL_WA_ID, state: AccountState.Waitlisted });
  });
});

describe('finishDeletingAccounts', () => {
  test('finishes every deleting account and no other', async () => {
    const { environment, account, dependencies } = await setup();
    const active = await environment.openAccount({ waId: '5521988887777', accountId: 'account_active' });
    await environment.directory.setState({ accountId: account.accountId, state: AccountState.Deleting });
    const purged: string[] = [];
    await finishDeletingAccounts({
      dependencies,
      inboxPurgeFor: ({ accountId }) => ({
        purge: async () => {
          purged.push(accountId);
        },
      }),
    });
    expect(purged).toEqual([account.accountId]);
    expect(await environment.directory.findByWaId({ waId: active.waId })).not.toBeNull();
    expect(await environment.directory.findByWaId({ waId: BRAZIL_WA_ID })).toBeNull();
  });
});

describe('resumeSuspendedAccount', () => {
  test('a suspended account becomes active', async () => {
    const { environment } = await setup();
    const suspended = await environment.openAccount({
      waId: '5521988887777',
      accountId: 'account_suspended',
      state: AccountState.Suspended,
    });
    expect(await resumeSuspendedAccount({ dependencies: environment.lifecycle, accountId: suspended.accountId })).toBe(true);
    expect((await environment.directory.findByWaId({ waId: suspended.waId }))!.state).toBe(AccountState.Active);
  });

  test.each([AccountState.Active, AccountState.Waitlisted, AccountState.Deleting])(
    'a %s account is refused and unchanged',
    async (state) => {
      const { environment } = await setup();
      const account = await environment.openAccount({ waId: '5521988887777', accountId: 'account_other', state });
      expect(await resumeSuspendedAccount({ dependencies: environment.lifecycle, accountId: account.accountId })).toBe(false);
      expect((await environment.directory.findByWaId({ waId: account.waId }))!.state).toBe(state);
    },
  );
});
