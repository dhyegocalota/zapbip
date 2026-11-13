import { AccountState, DAY_MS, WAITLIST_INVITE_TTL_MS } from '@zapbip/types';
import { INVITE_CODE_PREFIX, findInviteCode } from '@zapbip/core';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D1AccessInvites } from '../../src/adapters/d1/d1-access-invites';
import { D1AccountDirectory } from '../../src/adapters/d1/d1-account-directory';
import { applyDirectoryMigration, seedAccount, seedOwnerIdentity } from '../support/seed';
import { testEnv } from '../support/workers-env';
import { OwnerLocale } from '@zapbip/types';

const NOW = 1_800_000_000_000;
const EMAIL = 'someone@example.com';
const CONCURRENT_CALLS = 20;

function directory(): D1AccountDirectory {
  return new D1AccountDirectory({ database: testEnv.CONNECTIONS });
}

function invites(): D1AccessInvites {
  return new D1AccessInvites({ database: testEnv.CONNECTIONS });
}

async function stateOf(input: { accountId: string }): Promise<{ state: string; released_at: number | null }> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT state, released_at FROM accounts WHERE id = ?')
    .bind(input.accountId)
    .first<{ state: string; released_at: number | null }>();
  if (row === null) throw new Error('the account is missing');
  return row;
}

beforeEach(applyDirectoryMigration);
afterEach(() => reset());

describe('D1AccountDirectory.release', () => {
  it('moves a waitlisted account to active and stores the release time', async () => {
    await seedAccount({ accountId: 'acct_w', state: AccountState.Waitlisted });
    expect(await directory().release({ accountId: 'acct_w', releasedAt: NOW })).toBe(true);
    expect(await stateOf({ accountId: 'acct_w' })).toEqual({ state: AccountState.Active, released_at: NOW });
  });

  it.each([AccountState.Active, AccountState.Suspended, AccountState.Deleting])('leaves a %s account alone', async (state) => {
    await seedAccount({ accountId: 'acct_x', state });
    expect(await directory().release({ accountId: 'acct_x', releasedAt: NOW })).toBe(false);
    expect(await stateOf({ accountId: 'acct_x' })).toEqual({ state, released_at: null });
  });

  it('lets exactly one of many concurrent releases win', async () => {
    await seedAccount({ accountId: 'acct_race', state: AccountState.Waitlisted });
    const outcomes = await Promise.all(
      Array.from({ length: CONCURRENT_CALLS }, () => directory().release({ accountId: 'acct_race', releasedAt: NOW })),
    );
    expect(outcomes.filter(Boolean)).toHaveLength(1);
  });

  it('finds an account by id with its phone and locale, and null for an unknown id', async () => {
    await seedOwnerIdentity({ accountId: 'acct_f', phone: '5511900000042', ownerLocale: OwnerLocale.PortugueseBrazil });
    expect(await directory().findById({ accountId: 'acct_f' })).toMatchObject({
      accountId: 'acct_f',
      waId: '5511900000042',
      locale: OwnerLocale.PortugueseBrazil,
    });
    expect(await directory().findById({ accountId: 'acct_missing' })).toBeNull();
  });
});

describe('D1AccessInvites', () => {
  it('issues a code that the core finder recognises and stores only its digest', async () => {
    const code = await invites().issue({ email: EMAIL, now: NOW });
    expect(code.startsWith(INVITE_CODE_PREFIX)).toBe(true);
    expect(findInviteCode({ text: code })).toBe(code);
    const { results } = await testEnv.CONNECTIONS.prepare('SELECT * FROM waitlist_invites').all<Record<string, unknown>>();
    expect(results).toHaveLength(1);
    expect(JSON.stringify(results)).not.toContain(code);
    expect(results[0]).toMatchObject({ email: EMAIL, created_at: NOW, expires_at: NOW + WAITLIST_INVITE_TTL_MS, used_at: null });
  });

  it('consumes a live code once, in any letter case', async () => {
    const code = await invites().issue({ email: EMAIL, now: NOW });
    expect(await invites().consume({ code: code.toUpperCase(), now: NOW + 1 })).toBe(true);
    expect(await invites().consume({ code, now: NOW + 2 })).toBe(false);
  });

  it('refuses an unknown code and an expired one', async () => {
    const code = await invites().issue({ email: EMAIL, now: NOW });
    expect(await invites().consume({ code: `${INVITE_CODE_PREFIX}${'0'.repeat(24)}`, now: NOW })).toBe(false);
    expect(await invites().consume({ code, now: NOW + WAITLIST_INVITE_TTL_MS })).toBe(false);
    expect(await invites().consume({ code, now: NOW + WAITLIST_INVITE_TTL_MS - DAY_MS })).toBe(true);
  });

  it('lets exactly one of many concurrent redemptions win', async () => {
    const code = await invites().issue({ email: EMAIL, now: NOW });
    const outcomes = await Promise.all(Array.from({ length: CONCURRENT_CALLS }, () => invites().consume({ code, now: NOW + 1 })));
    expect(outcomes.filter(Boolean)).toHaveLength(1);
  });
});
