import { reset } from 'cloudflare:test';
import { DEFAULT_WAITLIST_REFERRAL_CAP, WAITLIST_REFERRAL_CAP_MAX, WAITLIST_REFERRAL_CAP_MIN } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readReferralCap, writeReferralCap } from '../../src/site/site-settings';
import { applyLandingWaitlistMigration, SEED_CREATED_AT } from '../support/seed';
import { testEnv } from '../support/workers-env';

const database = (): D1Database => testEnv.CONNECTIONS;

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('referral cap setting', () => {
  it('reads the seeded cap', async () => {
    expect(await readReferralCap({ database: database() })).toBe(DEFAULT_WAITLIST_REFERRAL_CAP);
  });

  it('readReferralCap throws when the row is missing', async () => {
    await database().prepare('DELETE FROM site_settings').run();
    await expect(readReferralCap({ database: database() })).rejects.toThrow('waitlist_referral_cap');
  });

  it.each([WAITLIST_REFERRAL_CAP_MIN - 1, WAITLIST_REFERRAL_CAP_MAX + 1, 2.5])(
    'writeReferralCap refuses %s and keeps the stored value',
    async (value) => {
      await expect(writeReferralCap({ database: database(), value, now: SEED_CREATED_AT })).rejects.toThrow(RangeError);
      expect(await readReferralCap({ database: database() })).toBe(DEFAULT_WAITLIST_REFERRAL_CAP);
    },
  );

  it.each([WAITLIST_REFERRAL_CAP_MIN, WAITLIST_REFERRAL_CAP_MAX])('writeReferralCap accepts %s', async (value) => {
    await writeReferralCap({ database: database(), value, now: SEED_CREATED_AT });
    expect(await readReferralCap({ database: database() })).toBe(value);
  });

  it('a stored value that is not an integer is an error', async () => {
    await database().prepare("UPDATE site_settings SET value = 'five'").run();
    await expect(readReferralCap({ database: database() })).rejects.toThrow('waitlist_referral_cap');
  });
});
