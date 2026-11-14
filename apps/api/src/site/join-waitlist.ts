import { type WebLocale, SiteSettingKey, WAITLIST_EMAIL_MAX_LENGTH, WaitlistJoinOutcome, WaitlistSource } from '@zapbip/types';
import { createRandomReferralCode, isReferralCode } from './referral-code';
import { EMAIL_PATTERN, REFERRAL_CODE_CLASH_ATTEMPTS } from './site-constants';
import { readReferralCap } from './site-settings';

export type WaitlistJoinResult =
  | {
      outcome: WaitlistJoinOutcome.Joined | WaitlistJoinOutcome.AlreadyJoined;
      referralCode: string;
      creditedCount: number;
      cap: number;
    }
  | { outcome: WaitlistJoinOutcome.InvalidEmail }
  | { outcome: WaitlistJoinOutcome.Unavailable };

export type JoinWaitlistInput = {
  database: D1Database;
  email: string;
  locale: WebLocale;
  referralCode: string | null;
  source: WaitlistSource;
  now: number;
  generateReferralCode?: () => string;
};

const INSERT_STATEMENT = `INSERT INTO landing_waitlist (email, locale, referral_code, referred_by, credited, created_at, source)
SELECT ?1, ?2, ?3, referrer.referral_code,
  CASE WHEN referrer.referral_code IS NOT NULL
    AND (SELECT COUNT(*) FROM landing_waitlist WHERE referred_by = referrer.referral_code AND credited = 1)
      < (SELECT CAST(value AS INTEGER) FROM site_settings WHERE key = '${SiteSettingKey.WaitlistReferralCap}')
  THEN 1 ELSE 0 END,
  ?4, ?6
FROM (SELECT 1) AS seed LEFT JOIN landing_waitlist AS referrer ON referrer.referral_code = ?5
ON CONFLICT (email) DO UPDATE SET source = excluded.source, locale = excluded.locale
  WHERE landing_waitlist.source = '${WaitlistSource.Agent}' AND excluded.source = '${WaitlistSource.Form}'`;
const SELECT_STATEMENT = `SELECT referral_code AS referralCode,
  (SELECT COUNT(*) FROM landing_waitlist WHERE referred_by = me.referral_code AND credited = 1) AS creditedCount
FROM landing_waitlist AS me WHERE email = ?`;
const CODE_CLASH_MARKER = 'landing_waitlist.referral_code';

type StoredRow = { referralCode: string; creditedCount: number };

export function normalizeEmail(input: { email: string }): string | null {
  const email = input.email.trim().toLowerCase();
  const isValid = email.length <= WAITLIST_EMAIL_MAX_LENGTH && EMAIL_PATTERN.test(email);
  return isValid ? email : null;
}

function isCodeClash(input: { error: unknown }): boolean {
  return input.error instanceof Error && input.error.message.includes(CODE_CLASH_MARKER);
}

async function insertAndRead(input: {
  join: JoinWaitlistInput;
  email: string;
  referralCode: string;
  referrerCode: string | null;
}): Promise<{ isNew: boolean; stored: StoredRow } | null> {
  const { join, email, referralCode, referrerCode } = input;
  const { database } = join;
  const results = await database
    .batch<StoredRow>([
      database.prepare(INSERT_STATEMENT).bind(email, join.locale, referralCode, join.now, referrerCode, join.source),
      database.prepare(SELECT_STATEMENT).bind(email),
    ])
    .catch((error: unknown) => {
      if (isCodeClash({ error })) return null;
      throw error;
    });
  if (results === null) return null;
  const [insertion, selection] = results;
  return { isNew: insertion!.meta.changes > 0, stored: selection!.results[0]! };
}

async function joinWithAttempts(input: {
  join: JoinWaitlistInput;
  email: string;
  cap: number;
  attemptsLeft: number;
}): Promise<WaitlistJoinResult> {
  const { join, email, cap, attemptsLeft } = input;
  if (attemptsLeft === 0) return { outcome: WaitlistJoinOutcome.Unavailable };
  const { generateReferralCode = createRandomReferralCode } = join;
  const referrerCode = join.referralCode !== null && isReferralCode({ value: join.referralCode }) ? join.referralCode : null;
  const written = await insertAndRead({ join, email, referralCode: generateReferralCode(), referrerCode });
  if (written === null) return joinWithAttempts({ join, email, cap, attemptsLeft: attemptsLeft - 1 });
  const outcome = written.isNew ? WaitlistJoinOutcome.Joined : WaitlistJoinOutcome.AlreadyJoined;
  return { outcome, ...written.stored, cap };
}

export async function joinWaitlist(input: JoinWaitlistInput): Promise<WaitlistJoinResult> {
  const email = normalizeEmail({ email: input.email });
  if (email === null) return { outcome: WaitlistJoinOutcome.InvalidEmail };
  const cap = await readReferralCap({ database: input.database }).catch(() => null);
  if (cap === null) return { outcome: WaitlistJoinOutcome.Unavailable };
  return joinWithAttempts({ join: input, email, cap, attemptsLeft: REFERRAL_CODE_CLASH_ATTEMPTS });
}
