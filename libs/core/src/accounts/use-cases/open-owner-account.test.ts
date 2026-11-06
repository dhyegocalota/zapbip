import { AccountState, DAY_MS, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { NEW_ACCOUNTS_PER_DAY_LIMIT } from '../constants';
import { createInMemoryAccountDependencies } from '../testing/in-memory-accounts';
import { BRAZIL_WA_ID, UNITED_STATES_WA_ID } from '../testing/fixtures';
import { openOwnerAccount } from './open-owner-account';

const NOW = 10 * DAY_MS;

async function seedAccounts(input: { count: number; createdAt: number }) {
  const environment = createInMemoryAccountDependencies();
  await Promise.all(
    Array.from({ length: input.count }, (_, index) =>
      environment.directory.findOrCreateByWaId({
        waId: `1000000${index}`,
        accountId: `seed_${index}`,
        initialState: AccountState.Active,
        locale: OwnerLocale.EnglishUs,
        createdAt: input.createdAt,
        newAccountsCap: { since: 0, limit: NEW_ACCOUNTS_PER_DAY_LIMIT + input.count },
      }),
    ),
  );
  return environment;
}

function open(input: { environment: Awaited<ReturnType<typeof seedAccounts>>; waId: string; waitlistEnabled?: boolean }) {
  const { environment, waId, waitlistEnabled = false } = input;
  return openOwnerAccount({ dependencies: environment.lifecycle, waId, waitlistEnabled, createdAt: NOW });
}

describe('openOwnerAccount', () => {
  test('a Brazilian number starts waitlisted in pt_BR when the flag is on', async () => {
    const environment = await seedAccounts({ count: 0, createdAt: NOW });
    const account = await open({ environment, waId: BRAZIL_WA_ID, waitlistEnabled: true });
    expect(account).toMatchObject({ waId: BRAZIL_WA_ID, state: AccountState.Waitlisted, locale: OwnerLocale.PortugueseBrazil });
  });

  test('another number starts active in en_US when the flag is off', async () => {
    const environment = await seedAccounts({ count: 0, createdAt: NOW });
    const account = await open({ environment, waId: UNITED_STATES_WA_ID });
    expect(account).toMatchObject({ state: AccountState.Active, locale: OwnerLocale.EnglishUs });
  });

  test('an existing account is returned unchanged', async () => {
    const environment = await seedAccounts({ count: 0, createdAt: NOW });
    const first = await open({ environment, waId: BRAZIL_WA_ID });
    const second = await open({ environment, waId: BRAZIL_WA_ID, waitlistEnabled: true });
    expect(second!.accountId).toBe(first!.accountId);
    expect(second!.state).toBe(AccountState.Active);
    expect(environment.registry.countAccounts()).toBe(1);
  });

  test('the daily cap refuses a new number', async () => {
    const environment = await seedAccounts({ count: NEW_ACCOUNTS_PER_DAY_LIMIT, createdAt: NOW - 1 });
    expect(await open({ environment, waId: BRAZIL_WA_ID })).toBeNull();
    expect(environment.registry.countAccounts()).toBe(NEW_ACCOUNTS_PER_DAY_LIMIT);
  });

  test('accounts older than the window do not count', async () => {
    const environment = await seedAccounts({ count: NEW_ACCOUNTS_PER_DAY_LIMIT, createdAt: NOW - DAY_MS - 1 });
    expect(await open({ environment, waId: BRAZIL_WA_ID })).not.toBeNull();
  });

  test('one below the cap still creates', async () => {
    const environment = await seedAccounts({ count: NEW_ACCOUNTS_PER_DAY_LIMIT - 1, createdAt: NOW - 1 });
    expect(await open({ environment, waId: BRAZIL_WA_ID })).not.toBeNull();
  });

  test('two concurrent calls for one number yield one account', async () => {
    const environment = await seedAccounts({ count: 0, createdAt: NOW });
    const [first, second] = await Promise.all([open({ environment, waId: BRAZIL_WA_ID }), open({ environment, waId: BRAZIL_WA_ID })]);
    expect(first!.accountId).toBe(second!.accountId);
    expect(environment.registry.countAccounts()).toBe(1);
  });
});
