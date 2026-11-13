import { reset } from 'cloudflare:test';
import { DEFAULT_WAITLIST_REFERRAL_CAP, OwnerLocale, WAITLIST_EMAIL_MAX_LENGTH, WaitlistJoinOutcome, WaitlistSource } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { joinWaitlist } from '../../src/site/join-waitlist';
import { applyLandingWaitlistMigration, SEED_CREATED_AT } from '../support/seed';
import { join, joinedCodeOf, rowOf, setCap, waitlistRows } from '../support/waitlist';
import { testEnv } from '../support/workers-env';

const UNKNOWN_CODE = 'abcdefgh2345';
const MALFORMED_CODE = '../../x';
const LAST_SLOT_RACERS = 20;

function fillReferrer(input: { referralCode: string; count: number }): Promise<unknown[]> {
  return Promise.all(
    Array.from({ length: input.count }, (_, index) => join({ email: `friend${index}@example.com`, referralCode: input.referralCode })),
  );
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('joinWaitlist', () => {
  it('joins a new email and returns Joined', async () => {
    const result = await join({ email: 'Maria@Example.com ', locale: OwnerLocale.PortugueseBrazil });
    expect(result).toMatchObject({ outcome: WaitlistJoinOutcome.Joined, creditedCount: 0, cap: DEFAULT_WAITLIST_REFERRAL_CAP });
    expect(await waitlistRows()).toEqual([
      expect.objectContaining({ email: 'maria@example.com', locale: OwnerLocale.PortugueseBrazil, credited: 0, referred_by: null }),
    ]);
  });

  it('duplicate email returns AlreadyJoined and writes nothing', async () => {
    const referrerCode = await joinedCodeOf({ email: 'referrer@example.com' });
    const firstCode = await joinedCodeOf({ email: 'maria@example.com' });
    const second = await join({ email: 'maria@example.com', locale: OwnerLocale.PortugueseBrazil, referralCode: referrerCode });
    expect(second).toMatchObject({ outcome: WaitlistJoinOutcome.AlreadyJoined, referralCode: firstCode });
    expect(await rowOf({ email: 'maria@example.com' })).toMatchObject({ locale: OwnerLocale.EnglishUs, referred_by: null, credited: 0 });
    expect(await waitlistRows()).toHaveLength(2);
    expect(await join({ email: 'referrer@example.com' })).toMatchObject({ creditedCount: 0 });
  });

  it('credits the referrer under the cap', async () => {
    const referrerCode = await joinedCodeOf({ email: 'referrer@example.com' });
    const friend = await join({ email: 'friend@example.com', referralCode: referrerCode });
    expect(friend.outcome).toBe(WaitlistJoinOutcome.Joined);
    expect(await rowOf({ email: 'friend@example.com' })).toMatchObject({ credited: 1, referred_by: referrerCode });
    expect(await join({ email: 'referrer@example.com' })).toMatchObject({ creditedCount: 1 });
  });

  it('the cap is read from the settings row', async () => {
    await setCap({ value: 2 });
    const referrerCode = await joinedCodeOf({ email: 'referrer@example.com' });
    await fillReferrer({ referralCode: referrerCode, count: 2 });
    const third = await join({ email: 'third@example.com', referralCode: referrerCode });
    expect(third.outcome).toBe(WaitlistJoinOutcome.Joined);
    expect(await rowOf({ email: 'third@example.com' })).toMatchObject({ credited: 0, referred_by: referrerCode });
  });

  it('past the cap still joins uncredited', async () => {
    const referrerCode = await joinedCodeOf({ email: 'referrer@example.com' });
    await fillReferrer({ referralCode: referrerCode, count: DEFAULT_WAITLIST_REFERRAL_CAP });
    const sixth = await join({ email: 'sixth@example.com', referralCode: referrerCode });
    expect(sixth.outcome).toBe(WaitlistJoinOutcome.Joined);
    expect(await rowOf({ email: 'sixth@example.com' })).toMatchObject({ credited: 0, referred_by: referrerCode });
    expect(await join({ email: 'referrer@example.com' })).toMatchObject({ creditedCount: DEFAULT_WAITLIST_REFERRAL_CAP });
  });

  it('self-referral is a duplicate and never credits', async () => {
    const referrerCode = await joinedCodeOf({ email: 'owner@example.com' });
    const result = await join({ email: 'Owner@example.com ', referralCode: referrerCode });
    expect(result.outcome).toBe(WaitlistJoinOutcome.AlreadyJoined);
    expect(await waitlistRows()).toHaveLength(1);
    expect(await join({ email: 'owner@example.com' })).toMatchObject({ creditedCount: 0 });
  });

  it('unknown referral code joins uncredited', async () => {
    const result = await join({ email: 'maria@example.com', referralCode: UNKNOWN_CODE });
    expect(result.outcome).toBe(WaitlistJoinOutcome.Joined);
    expect(await rowOf({ email: 'maria@example.com' })).toMatchObject({ credited: 0, referred_by: null });
  });

  it('malformed referral code is ignored', async () => {
    const result = await join({ email: 'maria@example.com', referralCode: MALFORMED_CODE });
    expect(result.outcome).toBe(WaitlistJoinOutcome.Joined);
    expect(await rowOf({ email: 'maria@example.com' })).toMatchObject({ credited: 0, referred_by: null });
  });

  it.each([
    'not-an-email',
    '',
    'a@b',
    '=HYPERLINK("x")@example.com',
    'two words@example.com',
    `${'a'.repeat(WAITLIST_EMAIL_MAX_LENGTH)}@example.com`,
  ])('invalid email #%# is refused before any write', async (email) => {
    expect((await join({ email })).outcome).toBe(WaitlistJoinOutcome.InvalidEmail);
    expect(await waitlistRows()).toEqual([]);
  });

  it('referral code clash is retried', async () => {
    const takenCode = await joinedCodeOf({ email: 'first@example.com' });
    const freshCode = 'fresh2345678';
    const codes = [takenCode, freshCode];
    const result = await join({ email: 'second@example.com', generateReferralCode: () => codes.shift()! });
    expect(result).toMatchObject({ outcome: WaitlistJoinOutcome.Joined, referralCode: freshCode });
  });

  it('a third clash fails closed', async () => {
    const takenCode = await joinedCodeOf({ email: 'first@example.com' });
    const result = await join({ email: 'second@example.com', generateReferralCode: () => takenCode });
    expect(result.outcome).toBe(WaitlistJoinOutcome.Unavailable);
    expect(await waitlistRows()).toHaveLength(1);
  });

  it('fails closed when the cap row is missing', async () => {
    await testEnv.CONNECTIONS.prepare('DELETE FROM site_settings').run();
    expect((await join({ email: 'maria@example.com' })).outcome).toBe(WaitlistJoinOutcome.Unavailable);
    expect(await waitlistRows()).toEqual([]);
  });

  it('two joins racing for the last slot credit exactly one', async () => {
    const referrerCode = await joinedCodeOf({ email: 'referrer@example.com' });
    await fillReferrer({ referralCode: referrerCode, count: DEFAULT_WAITLIST_REFERRAL_CAP - 1 });
    await Promise.all(
      Array.from({ length: LAST_SLOT_RACERS }, (_, index) => join({ email: `racer${index}@example.com`, referralCode: referrerCode })),
    );
    expect(await join({ email: 'referrer@example.com' })).toMatchObject({ creditedCount: DEFAULT_WAITLIST_REFERRAL_CAP });
  });

  it('two identical emails racing leave one row', async () => {
    const results = await Promise.all([join({ email: 'maria@example.com' }), join({ email: 'maria@example.com' })]);
    expect(results.map((result) => result.outcome).sort()).toEqual([WaitlistJoinOutcome.AlreadyJoined, WaitlistJoinOutcome.Joined]);
    expect(await waitlistRows()).toHaveLength(1);
  });

  it('writes the row and reads it back in one batch', async () => {
    const batches: number[] = [];
    const database = new Proxy(testEnv.CONNECTIONS, {
      get(target, property) {
        const member = Reflect.get(target, property);
        if (property !== 'batch') return typeof member === 'function' ? member.bind(target) : member;
        return (statements: D1PreparedStatement[]) => {
          batches.push(statements.length);
          return target.batch(statements);
        };
      },
    });
    await joinWaitlist({
      database,
      email: 'maria@example.com',
      locale: OwnerLocale.EnglishUs,
      referralCode: null,
      source: WaitlistSource.Form,
      now: SEED_CREATED_AT,
    });
    expect(batches).toEqual([2]);
  });
});
