import { AccountState } from '@zapbip/types';
import type { OwnerAccountContext } from '../account-types';
import { findInviteCode } from '../invite-code';
import type { AccessDependencies } from '../ports';

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
  const isRedeemed = await dependencies.invites.redeem({ code, accountId: account.accountId, now });
  if (!isRedeemed) return unchanged;
  return { account: { ...account, state: AccountState.Active }, isRedeemed };
}
