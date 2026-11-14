import type { OwnerLocale, WaitlistSource } from '@zapbip/types';

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

export async function readSubscriberDigestFacts(_input: {
  database: D1Database;
  since: number;
  until: number;
}): Promise<SubscriberDigestFacts> {
  throw new Error('readSubscriberDigestFacts is not implemented');
}
