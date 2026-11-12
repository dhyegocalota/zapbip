import { reset } from 'cloudflare:test';
import { DEFAULT_WAITLIST_REFERRAL_CAP, SiteSettingKey } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import landingWaitlistMigrationSql from '../../migrations/0010_landing_waitlist.sql?raw';
import { applyLandingWaitlistMigration, SEED_CREATED_AT } from '../support/seed';
import { testEnv } from '../support/workers-env';

function insertRow(input: { email: string; code: string; credited?: number }) {
  const { credited = 0 } = input;
  return testEnv.CONNECTIONS.prepare(
    'INSERT INTO landing_waitlist (email, locale, referral_code, referred_by, credited, created_at) VALUES (?, ?, ?, NULL, ?, ?)',
  ).bind(input.email, 'en_US', input.code, credited, SEED_CREATED_AT);
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('migration 0010', () => {
  it('seeds the cap with the shared default', async () => {
    const row = await testEnv.CONNECTIONS.prepare('SELECT value FROM site_settings WHERE key = ?')
      .bind(SiteSettingKey.WaitlistReferralCap)
      .first();
    expect(row).toEqual({ value: String(DEFAULT_WAITLIST_REFERRAL_CAP) });
  });

  it('the migration text seeds the same number as the shared constant', () => {
    const seeded = /VALUES \('waitlist_referral_cap', '(\d+)'/.exec(landingWaitlistMigrationSql);
    expect(Number(seeded![1])).toBe(DEFAULT_WAITLIST_REFERRAL_CAP);
  });

  it('refuses a second row with the same email', async () => {
    await insertRow({ email: 'maria@example.com', code: 'aaaaaaaaaaaa' }).run();
    await expect(insertRow({ email: 'maria@example.com', code: 'bbbbbbbbbbbb' }).run()).rejects.toThrow();
  });

  it('refuses a second row with the same referral code', async () => {
    await insertRow({ email: 'maria@example.com', code: 'aaaaaaaaaaaa' }).run();
    await expect(insertRow({ email: 'joao@example.com', code: 'aaaaaaaaaaaa' }).run()).rejects.toThrow();
  });

  it('refuses a credited flag outside 0 and 1', async () => {
    await expect(insertRow({ email: 'maria@example.com', code: 'aaaaaaaaaaaa', credited: 2 }).run()).rejects.toThrow();
  });
});
