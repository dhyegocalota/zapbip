import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { countWaitlist, listWaitlist } from '../../src/backoffice/waitlist/waitlist-queries';
import { applyLandingWaitlistMigration } from '../support/seed';
import { seedWaitlistRow } from '../support/waitlist';
import { testEnv } from '../support/workers-env';

const FIRST_AT = Date.UTC(2026, 10, 12, 9);
const MINUTE = 60_000;
const NO_LIMIT = -1;

function list(input: { limit: number }) {
  return listWaitlist({ database: testEnv.CONNECTIONS, limit: input.limit });
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('the waitlist queries', () => {
  it('counts every row', async () => {
    expect(await countWaitlist({ database: testEnv.CONNECTIONS })).toBe(0);
    await seedWaitlistRow({ email: 'a@example.com', referralCode: 'aaaaaaaaaaaa', createdAt: FIRST_AT });
    expect(await countWaitlist({ database: testEnv.CONNECTIONS })).toBe(1);
  });

  it('orders by credited count, then by join time', async () => {
    await seedWaitlistRow({ email: 'first@example.com', referralCode: 'aaaaaaaaaaaa', createdAt: FIRST_AT });
    await seedWaitlistRow({ email: 'second@example.com', referralCode: 'bbbbbbbbbbbb', createdAt: FIRST_AT + MINUTE });
    await seedWaitlistRow({ email: 'third@example.com', referralCode: 'cccccccccccc', createdAt: FIRST_AT + 2 * MINUTE });
    await seedWaitlistRow({
      email: 'f1@example.com',
      referralCode: 'dddddddddddd',
      referredBy: 'bbbbbbbbbbbb',
      credited: 1,
      createdAt: FIRST_AT + 3 * MINUTE,
    });
    await seedWaitlistRow({
      email: 'f2@example.com',
      referralCode: 'eeeeeeeeeeee',
      referredBy: 'bbbbbbbbbbbb',
      credited: 1,
      createdAt: FIRST_AT + 4 * MINUTE,
    });
    await seedWaitlistRow({
      email: 'f3@example.com',
      referralCode: 'ffffffffffff',
      referredBy: 'cccccccccccc',
      credited: 1,
      createdAt: FIRST_AT + 5 * MINUTE,
    });
    const rows = await list({ limit: NO_LIMIT });
    expect(rows.map((row) => [row.email, row.creditedCount])).toEqual([
      ['second@example.com', 2],
      ['third@example.com', 1],
      ['first@example.com', 0],
      ['f1@example.com', 0],
      ['f2@example.com', 0],
      ['f3@example.com', 0],
    ]);
  });

  it('names the referrer by email and leaves it null when there is none', async () => {
    await seedWaitlistRow({ email: 'referrer@example.com', referralCode: 'aaaaaaaaaaaa', createdAt: FIRST_AT });
    await seedWaitlistRow({
      email: 'friend@example.com',
      referralCode: 'bbbbbbbbbbbb',
      referredBy: 'aaaaaaaaaaaa',
      credited: 1,
      createdAt: FIRST_AT + MINUTE,
    });
    const rows = await list({ limit: NO_LIMIT });
    expect(rows.find((row) => row.email === 'friend@example.com')?.referredByEmail).toBe('referrer@example.com');
    expect(rows.find((row) => row.email === 'referrer@example.com')?.referredByEmail).toBeNull();
  });

  it('honours the limit', async () => {
    await seedWaitlistRow({ email: 'a@example.com', referralCode: 'aaaaaaaaaaaa', createdAt: FIRST_AT });
    await seedWaitlistRow({ email: 'b@example.com', referralCode: 'bbbbbbbbbbbb', createdAt: FIRST_AT + MINUTE });
    expect(await list({ limit: 1 })).toHaveLength(1);
  });
});
