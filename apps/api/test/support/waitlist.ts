import { OwnerLocale, WaitlistJoinOutcome } from '@zapbip/types';
import { joinWaitlist, type WaitlistJoinResult } from '../../src/site/join-waitlist';
import { SEED_CREATED_AT } from './seed';
import { testEnv } from './workers-env';

export type WaitlistRow = {
  email: string;
  locale: string;
  referral_code: string;
  referred_by: string | null;
  credited: number;
  created_at: number;
};

export async function join(input: {
  email: string;
  referralCode?: string | null;
  locale?: OwnerLocale;
  generateReferralCode?: () => string;
}): Promise<WaitlistJoinResult> {
  const { email, referralCode = null, locale = OwnerLocale.EnglishUs, generateReferralCode } = input;
  return joinWaitlist({ database: testEnv.CONNECTIONS, email, locale, referralCode, now: SEED_CREATED_AT, generateReferralCode });
}

export async function joinedCodeOf(input: { email: string; referralCode?: string | null }): Promise<string> {
  const result = await join(input);
  if (result.outcome !== WaitlistJoinOutcome.Joined) throw new Error(`the seed join returned ${result.outcome}`);
  return result.referralCode;
}

export async function waitlistRows(): Promise<WaitlistRow[]> {
  const { results } = await testEnv.CONNECTIONS.prepare('SELECT * FROM landing_waitlist ORDER BY rowid').all<WaitlistRow>();
  return results;
}

export async function rowOf(input: { email: string }): Promise<WaitlistRow> {
  const row = (await waitlistRows()).find((candidate) => candidate.email === input.email);
  if (row === undefined) throw new Error(`no waitlist row for ${input.email}`);
  return row;
}

export async function setCap(input: { value: number }): Promise<void> {
  await testEnv.CONNECTIONS.prepare("UPDATE site_settings SET value = ? WHERE key = 'waitlist_referral_cap'")
    .bind(String(input.value))
    .run();
}

export async function seedWaitlistRow(input: {
  email: string;
  referralCode: string;
  referredBy?: string | null;
  credited?: number;
  createdAt: number;
}): Promise<void> {
  const { email, referralCode, referredBy = null, credited = 0, createdAt } = input;
  await testEnv.CONNECTIONS.prepare(
    'INSERT INTO landing_waitlist (email, locale, referral_code, referred_by, credited, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(email, OwnerLocale.EnglishUs, referralCode, referredBy, credited, createdAt)
    .run();
}

export async function resetWaitlist(): Promise<void> {
  await testEnv.CONNECTIONS.batch([
    testEnv.CONNECTIONS.prepare('DELETE FROM landing_waitlist'),
    testEnv.CONNECTIONS.prepare('DELETE FROM site_settings'),
    testEnv.CONNECTIONS.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES ('waitlist_referral_cap', '5', 1794441600000)"),
  ]);
}
