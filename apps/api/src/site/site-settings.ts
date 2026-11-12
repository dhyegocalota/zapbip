import { SiteSettingKey, WAITLIST_REFERRAL_CAP_MAX, WAITLIST_REFERRAL_CAP_MIN } from '@zapbip/types';

const SELECT_VALUE_STATEMENT = 'SELECT value FROM site_settings WHERE key = ?';
const UPDATE_VALUE_STATEMENT = 'UPDATE site_settings SET value = ?, updated_at = ? WHERE key = ?';
const INTEGER_PATTERN = /^\d+$/;

export function isReferralCapInRange(input: { value: number }): boolean {
  const { value } = input;
  return Number.isInteger(value) && value >= WAITLIST_REFERRAL_CAP_MIN && value <= WAITLIST_REFERRAL_CAP_MAX;
}

export async function readReferralCap(input: { database: D1Database }): Promise<number> {
  const row = await input.database.prepare(SELECT_VALUE_STATEMENT).bind(SiteSettingKey.WaitlistReferralCap).first<{ value: string }>();
  const isStoredInteger = row !== null && INTEGER_PATTERN.test(row.value);
  if (!isStoredInteger) throw new Error(`the ${SiteSettingKey.WaitlistReferralCap} setting is missing or not an integer`);
  return Number(row.value);
}

export async function writeReferralCap(input: { database: D1Database; value: number; now: number }): Promise<void> {
  const { database, value, now } = input;
  if (!isReferralCapInRange({ value }))
    throw new RangeError(`the referral cap must be a whole number from ${WAITLIST_REFERRAL_CAP_MIN} to ${WAITLIST_REFERRAL_CAP_MAX}`);
  await database.prepare(UPDATE_VALUE_STATEMENT).bind(String(value), now, SiteSettingKey.WaitlistReferralCap).run();
}
