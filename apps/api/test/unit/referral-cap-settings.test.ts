import { WAITLIST_REFERRAL_CAP_MAX, WAITLIST_REFERRAL_CAP_MIN } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { parseReferralCap } from '../../src/backoffice/waitlist/referral-cap-settings';

describe('parseReferralCap', () => {
  it.each(['5.5', 'five', '', ' ', '-1', '1e1', '0x10', '5 ', null])('rejects %j', (value) => {
    expect(parseReferralCap({ value })).toBeNull();
  });

  it.each([String(WAITLIST_REFERRAL_CAP_MIN - 1), String(WAITLIST_REFERRAL_CAP_MAX + 1)])('rejects %s outside the range', (value) => {
    expect(parseReferralCap({ value })).toBeNull();
  });

  it.each([WAITLIST_REFERRAL_CAP_MIN, 5, WAITLIST_REFERRAL_CAP_MAX])('accepts %s', (cap) => {
    expect(parseReferralCap({ value: String(cap) })).toBe(cap);
  });
});
