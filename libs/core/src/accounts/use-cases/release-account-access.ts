import { AccessReleaseOutcome, AccountState } from '@zapbip/types';
import type { AccountRecord } from '../account-types';
import type { AccessDependencies } from '../ports';

export type ReleaseAccountAccessInput = {
  dependencies: Pick<AccessDependencies, 'accounts'>;
  accountId: string;
  releasedAt: number;
};

export type ReleaseAccountAccessResult = { outcome: AccessReleaseOutcome; account: AccountRecord | null };

export async function releaseAccountAccess(input: ReleaseAccountAccessInput): Promise<ReleaseAccountAccessResult> {
  const { dependencies, accountId, releasedAt } = input;
  const isReleased = await dependencies.accounts.release({ accountId, releasedAt });
  const account = await dependencies.accounts.findById({ accountId });
  if (account === null) return { outcome: AccessReleaseOutcome.NotFound, account };
  if (isReleased) return { outcome: AccessReleaseOutcome.Released, account };
  if (account.state === AccountState.Active) return { outcome: AccessReleaseOutcome.AlreadyActive, account };
  return { outcome: AccessReleaseOutcome.NotWaitlisted, account };
}
