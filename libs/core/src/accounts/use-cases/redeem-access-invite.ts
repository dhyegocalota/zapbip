import type { OwnerAccountContext } from '../account-types';
import type { AccessDependencies } from '../ports';

export type RedeemAccessInviteInput = {
  dependencies: AccessDependencies;
  account: OwnerAccountContext;
  text: string | null;
  now: number;
};

export type RedeemAccessInviteResult = { account: OwnerAccountContext; isRedeemed: boolean };

export async function redeemAccessInvite(input: RedeemAccessInviteInput): Promise<RedeemAccessInviteResult> {
  throw new Error('redeemAccessInvite is not implemented');
}
