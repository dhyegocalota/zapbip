import type { OwnerLocale, WaitlistSource } from '@zapbip/types';
import { SUBSCRIBER_DIGEST_LIST_LIMIT, SUBSCRIBER_DIGEST_TOP_REFERRERS } from './constants';

export type DigestSubscriber = {
  email: string;
  locale: OwnerLocale;
  source: WaitlistSource;
  referrerEmail: string | null;
  joinedAt: number;
};
export type DigestLocaleTotal = { locale: OwnerLocale; total: number };
export type DigestReferrer = { email: string; total: number };

export type SubscriberDigestFacts = {
  newCount: number;
  newSubscribers: DigestSubscriber[];
  total: number;
  localeTotals: DigestLocaleTotal[];
  welcomesSent: number;
  welcomesFailed: number;
  topReferrers: DigestReferrer[];
};

type CountRow = { total: number };
type WelcomeRow = { sent: number; failed: number };

const NEW_SUBSCRIBERS_STATEMENT =
  'SELECT entry.email, entry.locale, entry.source, referrer.email AS referrerEmail, entry.created_at AS joinedAt ' +
  'FROM landing_waitlist AS entry LEFT JOIN landing_waitlist AS referrer ON referrer.referral_code = entry.referred_by ' +
  'WHERE entry.created_at > ?1 AND entry.created_at <= ?2 ORDER BY entry.created_at, entry.rowid LIMIT ?3';
const NEW_COUNT_STATEMENT = 'SELECT COUNT(*) AS total FROM landing_waitlist WHERE created_at > ?1 AND created_at <= ?2';
const TOTAL_STATEMENT = 'SELECT COUNT(*) AS total FROM landing_waitlist';
const LOCALE_TOTALS_STATEMENT = 'SELECT locale, COUNT(*) AS total FROM landing_waitlist GROUP BY locale ORDER BY total DESC, locale';
const WELCOMES_STATEMENT =
  'SELECT COUNT(CASE WHEN welcome_sent_at > ?1 AND welcome_sent_at <= ?2 THEN 1 END) AS sent, ' +
  'COUNT(CASE WHEN welcome_sent_at IS NULL AND welcome_failed_at > ?1 AND welcome_failed_at <= ?2 THEN 1 END) AS failed ' +
  'FROM landing_waitlist';
const TOP_REFERRERS_STATEMENT =
  'SELECT referrer.email AS email, COUNT(*) AS total ' +
  'FROM landing_waitlist AS entry JOIN landing_waitlist AS referrer ON referrer.referral_code = entry.referred_by ' +
  'WHERE entry.created_at > ?1 AND entry.created_at <= ?2 GROUP BY referrer.email ORDER BY total DESC, referrer.email LIMIT ?3';

export async function readSubscriberDigestFacts(input: {
  database: D1Database;
  since: number;
  until: number;
}): Promise<SubscriberDigestFacts> {
  const { database, since, until } = input;
  const [subscribers, newCount, total, localeTotals, welcomes, referrers] = await database.batch<unknown>([
    database.prepare(NEW_SUBSCRIBERS_STATEMENT).bind(since, until, SUBSCRIBER_DIGEST_LIST_LIMIT),
    database.prepare(NEW_COUNT_STATEMENT).bind(since, until),
    database.prepare(TOTAL_STATEMENT),
    database.prepare(LOCALE_TOTALS_STATEMENT),
    database.prepare(WELCOMES_STATEMENT).bind(since, until),
    database.prepare(TOP_REFERRERS_STATEMENT).bind(since, until, SUBSCRIBER_DIGEST_TOP_REFERRERS),
  ]);
  const welcomeRow = welcomes!.results[0] as WelcomeRow;
  return {
    newCount: (newCount!.results[0] as CountRow).total,
    newSubscribers: subscribers!.results as DigestSubscriber[],
    total: (total!.results[0] as CountRow).total,
    localeTotals: localeTotals!.results as DigestLocaleTotal[],
    welcomesSent: welcomeRow.sent,
    welcomesFailed: welcomeRow.failed,
    topReferrers: referrers!.results as DigestReferrer[],
  };
}
