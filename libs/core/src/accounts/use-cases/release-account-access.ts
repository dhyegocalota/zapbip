import type { AccessReleaseOutcome } from '@zapbip/types';
import type { AccountRecord } from '../account-types';
import type { AccessDependencies } from '../ports';

export type ReleaseAccountAccessInput = {
  dependencies: Pick<AccessDependencies, 'accounts'>;
  accountId: string;
  releasedAt: number;
};

export type ReleaseAccountAccessResult = { outcome: AccessReleaseOutcome; account: AccountRecord | null };

export async function releaseAccountAccess(input: ReleaseAccountAccessInput): Promise<ReleaseAccountAccessResult> {
  throw new Error('releaseAccountAccess is not implemented');
}
