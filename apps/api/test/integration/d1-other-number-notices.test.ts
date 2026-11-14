import { reset } from 'cloudflare:test';
import { DAY_MS } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D1OtherNumberNotices } from '../../src/adapters/d1/d1-other-number-notices';
import { applyDirectoryMigration } from '../support/seed';
import { testEnv } from '../support/workers-env';

const ACCOUNT_ID = 'acc_notice_claim';
const OTHER_ACCOUNT_ID = 'acc_notice_other';
const NOW = 1_000_000;

function noticesOf(): D1OtherNumberNotices {
  return new D1OtherNumberNotices({ database: testEnv.CONNECTIONS });
}

beforeEach(applyDirectoryMigration);

afterEach(() => reset());

describe('claiming the other-number notice', () => {
  it('lets exactly one of two simultaneous deliveries send it', async () => {
    const claims = await Promise.all([
      noticesOf().claim({ accountId: ACCOUNT_ID, now: NOW, cooldownMs: DAY_MS }),
      noticesOf().claim({ accountId: ACCOUNT_ID, now: NOW, cooldownMs: DAY_MS }),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it('refuses inside the cooldown and grants again after it', async () => {
    const notices = noticesOf();
    expect(await notices.claim({ accountId: ACCOUNT_ID, now: NOW, cooldownMs: DAY_MS })).toBe(true);
    expect(await notices.claim({ accountId: ACCOUNT_ID, now: NOW + DAY_MS - 1, cooldownMs: DAY_MS })).toBe(false);
    expect(await notices.claim({ accountId: ACCOUNT_ID, now: NOW + DAY_MS, cooldownMs: DAY_MS })).toBe(true);
  });

  it('keeps one cooldown per account', async () => {
    const notices = noticesOf();
    await notices.claim({ accountId: ACCOUNT_ID, now: NOW, cooldownMs: DAY_MS });
    expect(await notices.claim({ accountId: OTHER_ACCOUNT_ID, now: NOW, cooldownMs: DAY_MS })).toBe(true);
  });
});
