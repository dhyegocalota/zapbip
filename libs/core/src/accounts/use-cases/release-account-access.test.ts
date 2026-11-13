import { AccessReleaseOutcome, AccountState } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { createInMemoryAccountDependencies } from '../testing/in-memory-accounts';
import { releaseAccountAccess } from './release-account-access';

const RELEASED_AT = 1_000;

async function accountIn(input: { state: AccountState }) {
  const environment = createInMemoryAccountDependencies();
  const account = await environment.openAccount({ state: input.state });
  return { environment, account };
}

describe('releaseAccountAccess', () => {
  test('moves a waitlisted account to active', async () => {
    const { environment, account } = await accountIn({ state: AccountState.Waitlisted });
    const result = await releaseAccountAccess({ dependencies: environment.access, accountId: account.accountId, releasedAt: RELEASED_AT });
    expect(result.outcome).toBe(AccessReleaseOutcome.Released);
    expect(result.account?.state).toBe(AccountState.Active);
    expect((await environment.directory.findById({ accountId: account.accountId }))?.state).toBe(AccountState.Active);
  });

  test('releasing an active account again is a no-op', async () => {
    const { environment, account } = await accountIn({ state: AccountState.Waitlisted });
    await releaseAccountAccess({ dependencies: environment.access, accountId: account.accountId, releasedAt: RELEASED_AT });
    const second = await releaseAccountAccess({ dependencies: environment.access, accountId: account.accountId, releasedAt: RELEASED_AT });
    expect(second.outcome).toBe(AccessReleaseOutcome.AlreadyActive);
  });

  test.each([AccountState.Suspended, AccountState.Deleting])('never touches a %s account', async (state) => {
    const { environment, account } = await accountIn({ state });
    const result = await releaseAccountAccess({ dependencies: environment.access, accountId: account.accountId, releasedAt: RELEASED_AT });
    expect(result.outcome).toBe(AccessReleaseOutcome.NotWaitlisted);
    expect((await environment.directory.findById({ accountId: account.accountId }))?.state).toBe(state);
  });

  test('an unknown account is reported as not found', async () => {
    const { environment } = await accountIn({ state: AccountState.Waitlisted });
    const result = await releaseAccountAccess({ dependencies: environment.access, accountId: 'acct_missing', releasedAt: RELEASED_AT });
    expect(result).toEqual({ outcome: AccessReleaseOutcome.NotFound, account: null });
  });
});
