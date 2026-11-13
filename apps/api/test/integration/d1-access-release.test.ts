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

async function issued(input: { email?: string; now?: number } = {}): Promise<string> {
  const { email = EMAIL, now = NOW } = input;
  const [code] = await invites().issueMany({ emails: [email], now });
  if (code === undefined || code === null) throw new Error('the invite was not issued');
  return code;
}

function memberOf(input: { target: D1Database; property: string | symbol }): unknown {
  const member: unknown = Reflect.get(input.target, input.property);
  return typeof member === 'function' ? member.bind(input.target) : member;
}

function invites(): D1AccessInvites {
  return new D1AccessInvites({ database: testEnv.CONNECTIONS });
}

async function inviteRow(input: { index?: number } = {}): Promise<{ used_at: number | null; used_by_account_id: string | null }> {
  const { index = 0 } = input;
  const { results } = await testEnv.CONNECTIONS.prepare('SELECT used_at, used_by_account_id FROM waitlist_invites ORDER BY rowid').all<{
    used_at: number | null;
    used_by_account_id: string | null;
  }>();
  const row = results[index];
  if (row === undefined) throw new Error('no invite row');
  return row;
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
    const code = await issued();
    expect(code.startsWith(INVITE_CODE_PREFIX)).toBe(true);
    expect(findInviteCode({ text: code })).toBe(code);
    const { results } = await testEnv.CONNECTIONS.prepare('SELECT * FROM waitlist_invites').all<Record<string, unknown>>();
    expect(results).toHaveLength(1);
    expect(JSON.stringify(results)).not.toContain(code);
    expect(results[0]).toMatchObject({
      email: EMAIL,
      created_at: NOW,
      expires_at: NOW + WAITLIST_INVITE_TTL_MS,
      used_at: null,
      used_by_account_id: null,
    });
  });

  it('issues many codes in one database batch and skips an entry that holds a live code', async () => {
    await issued({ email: 'held@example.com' });
    let batchCalls = 0;
    const counting = new Proxy(testEnv.CONNECTIONS, {
      get(target, property) {
        if (property !== 'batch') return memberOf({ target, property });
        return (statements: D1PreparedStatement[]) => {
          batchCalls += 1;
          return target.batch(statements);
        };
      },
    });
    const outcomes = await new D1AccessInvites({ database: counting }).issueMany({
      emails: ['held@example.com', 'a@example.com', 'b@example.com'],
      now: NOW + 1,
    });
    expect(batchCalls).toBe(1);
    expect(outcomes.map((code) => code !== null)).toEqual([false, true, true]);
  });

  it('issues nothing when one statement of the batch fails', async () => {
    const failing = new Proxy(testEnv.CONNECTIONS, {
      get(target, property) {
        if (property !== 'batch') return memberOf({ target, property });
        return async (statements: D1PreparedStatement[]) =>
          target.batch([...statements, target.prepare('INSERT INTO missing_table VALUES (1)')]);
      },
    });
    await expect(
      new D1AccessInvites({ database: failing }).issueMany({ emails: ['a@example.com', 'b@example.com'], now: NOW }),
    ).rejects.toThrow();
    const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM waitlist_invites').first<{ total: number }>();
    expect(row?.total).toBe(0);
  });

  it('issues no second code while one is live or used, and again after it expired', async () => {
    await issued();
    expect(await invites().issueMany({ emails: [EMAIL], now: NOW + 1 })).toEqual([null]);
    const [again] = await invites().issueMany({ emails: [EMAIL], now: NOW + WAITLIST_INVITE_TTL_MS });
    expect(again).not.toBeNull();
  });

  it('redeems a live code once, in any letter case, opening the account and recording who used it', async () => {
    await seedAccount({ accountId: 'acct_a', state: AccountState.Waitlisted });
    await seedAccount({ accountId: 'acct_b', state: AccountState.Waitlisted });
    const code = await issued();
    expect(await invites().redeem({ code: code.toUpperCase(), accountId: 'acct_a', now: NOW + 1 })).toBe(true);
    expect(await invites().redeem({ code, accountId: 'acct_b', now: NOW + 2 })).toBe(false);
    expect(await stateOf({ accountId: 'acct_a' })).toEqual({ state: AccountState.Active, released_at: NOW + 1 });
    expect((await stateOf({ accountId: 'acct_b' })).state).toBe(AccountState.Waitlisted);
    expect(await inviteRow()).toEqual({ used_at: NOW + 1, used_by_account_id: 'acct_a' });
  });

  it('refuses an unknown code and an expired one and leaves the account waiting', async () => {
    await seedAccount({ accountId: 'acct_a', state: AccountState.Waitlisted });
    const code = await issued();
    expect(await invites().redeem({ code: `${INVITE_CODE_PREFIX}${'2'.repeat(24)}`, accountId: 'acct_a', now: NOW })).toBe(false);
    expect(await invites().redeem({ code, accountId: 'acct_a', now: NOW + WAITLIST_INVITE_TTL_MS })).toBe(false);
    expect((await stateOf({ accountId: 'acct_a' })).state).toBe(AccountState.Waitlisted);
    expect(await invites().redeem({ code, accountId: 'acct_a', now: NOW + WAITLIST_INVITE_TTL_MS - DAY_MS })).toBe(true);
  });

  it.each([AccountState.Active, AccountState.Suspended, AccountState.Deleting])('keeps the code unused for a %s account', async (state) => {
    await seedAccount({ accountId: 'acct_x', state });
    const code = await issued();
    expect(await invites().redeem({ code, accountId: 'acct_x', now: NOW + 1 })).toBe(false);
    expect(await inviteRow()).toEqual({ used_at: null, used_by_account_id: null });
    expect((await stateOf({ accountId: 'acct_x' })).state).toBe(state);
  });

  it('keeps the code unused when the operator suspended the account after it was read', async () => {
    await seedAccount({ accountId: 'acct_x', state: AccountState.Waitlisted });
    const code = await issued();
    await testEnv.CONNECTIONS.prepare("UPDATE accounts SET state = 'suspended' WHERE id = 'acct_x'").run();
    expect(await invites().redeem({ code, accountId: 'acct_x', now: NOW + 1 })).toBe(false);
    expect(await inviteRow()).toEqual({ used_at: null, used_by_account_id: null });
  });

  it('lets exactly one of many concurrent redemptions of one code win', async () => {
    await Promise.all(
      Array.from({ length: CONCURRENT_CALLS }, (_, index) => seedAccount({ accountId: `acct_${index}`, state: AccountState.Waitlisted })),
    );
    const code = await issued();
    const outcomes = await Promise.all(
      Array.from({ length: CONCURRENT_CALLS }, (_, index) => invites().redeem({ code, accountId: `acct_${index}`, now: NOW + 1 })),
    );
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const active = await testEnv.CONNECTIONS.prepare("SELECT COUNT(*) AS total FROM accounts WHERE state = 'active'").first<{
      total: number;
    }>();
    expect(active?.total).toBe(1);
  });

  it('spends only one of two codes sent by the same account at the same moment', async () => {
    await seedAccount({ accountId: 'acct_a', state: AccountState.Waitlisted });
    const first = await issued({ email: 'one@example.com' });
    const second = await issued({ email: 'two@example.com' });
    const outcomes = await Promise.all([first, second].map((code) => invites().redeem({ code, accountId: 'acct_a', now: NOW + 1 })));
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    const used = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM waitlist_invites WHERE used_at IS NOT NULL').first<{
      total: number;
    }>();
    expect(used?.total).toBe(1);
  });
});
