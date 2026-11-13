import { AccessReleaseOutcome, AccountState } from '@zapbip/types';
import type { OwnerAccountContext } from '../account-types';
import { findInviteCode } from '../invite-code';
import type { AccessDependencies } from '../ports';
import { releaseAccountAccess } from './release-account-access';

export type RedeemAccessInviteInput = {
  dependencies: AccessDependencies;
  account: OwnerAccountContext;
  text: string | null;
  now: number;
};

export type RedeemAccessInviteResult = { account: OwnerAccountContext; isRedeemed: boolean };

export async function redeemAccessInvite(input: RedeemAccessInviteInput): Promise<RedeemAccessInviteResult> {
  const { dependencies, account, text, now } = input;
  const unchanged: RedeemAccessInviteResult = { account, isRedeemed: false };
  const code = findInviteCode({ text });
  const isWaitlisted = account.state === AccountState.Waitlisted;
  if (code === null || !isWaitlisted) return unchanged;
  const isConsumed = await dependencies.invites.consume({ code, now });
  if (!isConsumed) return unchanged;
  const released = await releaseAccountAccess({ dependencies, accountId: account.accountId, releasedAt: now });
  if (released.outcome !== AccessReleaseOutcome.Released || released.account === null) return unchanged;
  return { account: released.account, isRedeemed: true };
}
