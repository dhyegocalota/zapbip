import { OwnerLocale } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { findOwnerByAccountId, findOwnerByPhone } from '../../src/adapters/d1/d1-owner-directory';
import { applyDirectoryMigration, seedAccount, seedOwnerIdentity, SEED_CREATED_AT } from '../support/seed';
import { testEnv } from '../support/workers-env';

const ACCOUNT_ID = 'acc_1';
const PHONE = '5511999990000';
const UNKNOWN_LOCALE = 'fr_FR';

async function seedOwnerWithRawLocale(input: { accountId: string; phone: string; locale: string }): Promise<void> {
  await seedAccount({ accountId: input.accountId });
  await testEnv.CONNECTIONS.prepare(
    'INSERT INTO owner_identities (wa_id, account_id, from_user_id, locale, created_at) VALUES (?, ?, NULL, ?, ?)',
  )
    .bind(input.phone, input.accountId, input.locale, SEED_CREATED_AT)
    .run();
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('D1 owner directory by account', () => {
  it('finds the recipient and the locale of an account', async () => {
    await seedOwnerIdentity({ accountId: ACCOUNT_ID, phone: PHONE, ownerLocale: OwnerLocale.EnglishUs });
    expect(await findOwnerByAccountId({ database: testEnv.CONNECTIONS, accountId: ACCOUNT_ID })).toEqual({
      waId: PHONE,
      ownerLocale: OwnerLocale.EnglishUs,
    });
  });

  it('returns null for an account with no owner identity', async () => {
    await seedAccount({ accountId: ACCOUNT_ID });
    expect(await findOwnerByAccountId({ database: testEnv.CONNECTIONS, accountId: ACCOUNT_ID })).toBeNull();
  });

  it('returns null for an unknown account', async () => {
    expect(await findOwnerByAccountId({ database: testEnv.CONNECTIONS, accountId: 'acc_none' })).toBeNull();
  });

  it('keeps one account apart from another', async () => {
    await seedOwnerIdentity({ accountId: ACCOUNT_ID, phone: PHONE, ownerLocale: OwnerLocale.PortugueseBrazil });
    await seedOwnerIdentity({ accountId: 'acc_2', phone: '5511888880000', ownerLocale: OwnerLocale.EnglishUs });
    expect(await findOwnerByAccountId({ database: testEnv.CONNECTIONS, accountId: 'acc_2' })).toEqual({
      waId: '5511888880000',
      ownerLocale: OwnerLocale.EnglishUs,
    });
  });

  it('throws naming the stored locale when it is not an owner locale', async () => {
    await seedOwnerWithRawLocale({ accountId: ACCOUNT_ID, phone: PHONE, locale: UNKNOWN_LOCALE });
    await expect(findOwnerByAccountId({ database: testEnv.CONNECTIONS, accountId: ACCOUNT_ID })).rejects.toThrow(UNKNOWN_LOCALE);
  });
});

describe('D1 owner directory by phone', () => {
  it('throws naming the stored locale when it is not an owner locale', async () => {
    await seedOwnerWithRawLocale({ accountId: ACCOUNT_ID, phone: PHONE, locale: UNKNOWN_LOCALE });
    await expect(findOwnerByPhone({ database: testEnv.CONNECTIONS, phone: PHONE })).rejects.toThrow(UNKNOWN_LOCALE);
  });

  it('still returns null for an unknown phone', async () => {
    expect(await findOwnerByPhone({ database: testEnv.CONNECTIONS, phone: PHONE })).toBeNull();
  });
});
