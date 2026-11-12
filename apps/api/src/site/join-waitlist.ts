import type { OwnerLocale, WaitlistJoinOutcome } from '@zapbip/types';

export type WaitlistJoinResult =
  | {
      outcome: WaitlistJoinOutcome.Joined | WaitlistJoinOutcome.AlreadyJoined;
      referralCode: string;
      creditedCount: number;
      cap: number;
    }
  | { outcome: WaitlistJoinOutcome.InvalidEmail | WaitlistJoinOutcome.Unavailable };

export type JoinWaitlistInput = {
  database: D1Database;
  email: string;
  locale: OwnerLocale;
  referralCode: string | null;
  now: number;
  generateReferralCode?: () => string;
};

export async function joinWaitlist(input: JoinWaitlistInput): Promise<WaitlistJoinResult> {
  throw new Error(`joinWaitlist is not implemented ${input.email}`);
}
