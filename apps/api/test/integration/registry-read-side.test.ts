import { WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { numberRegistryOf } from '../../src/adapters/d1/d1-number-registry';
import { applyDirectoryMigration, seedAccount } from '../support/seed';
import { seedWhatsAppNumber, TEST_ACCESS_TOKEN, TEST_NUMBER_ID, TEST_PHONE_NUMBER_ID, TEST_WABA_ID } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';

const ACCOUNT_ID = 'acc_registry';
const OTHER_NUMBER_ID = 'num_other';
const OTHER_PHONE_NUMBER_ID = '1000000000000002';
const UNKNOWN_ID = '9999999999999999';
const registry = numberRegistryOf({ bindings: testEnv });

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('the number registry read side', () => {
  it('finds a number by its phone number id and by its WABA id', async () => {
    await seedWhatsAppNumber();
    const expected = {
      numberId: TEST_NUMBER_ID,
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      wabaId: TEST_WABA_ID,
      state: WhatsAppNumberState.Active,
    };
    expect(await registry.findByPhoneNumberIds({ phoneNumberIds: [TEST_PHONE_NUMBER_ID, UNKNOWN_ID] })).toEqual([expected]);
    expect(await registry.findByWabaIds({ wabaIds: [TEST_WABA_ID] })).toEqual([expected]);
  });

  it('finds nothing for unknown ids and for an empty list', async () => {
    await seedWhatsAppNumber();
    expect(await registry.findByPhoneNumberIds({ phoneNumberIds: [UNKNOWN_ID] })).toEqual([]);
    expect(await registry.findByWabaIds({ wabaIds: [] })).toEqual([]);
  });

  it('opens the access token of a number for an inbound', async () => {
    await seedWhatsAppNumber();
    expect(await registry.openForInbound({ numberId: TEST_NUMBER_ID })).toMatchObject({
      numberId: TEST_NUMBER_ID,
      phoneNumberId: TEST_PHONE_NUMBER_ID,
      accessToken: TEST_ACCESS_TOKEN,
    });
  });

  it('opens the number an account is bound to', async () => {
    await seedWhatsAppNumber();
    await seedAccount({ accountId: ACCOUNT_ID });
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET number_id = ? WHERE id = ?').bind(TEST_NUMBER_ID, ACCOUNT_ID).run();
    expect(await registry.openForAccount({ accountId: ACCOUNT_ID })).toMatchObject({
      numberId: TEST_NUMBER_ID,
      accessToken: TEST_ACCESS_TOKEN,
    });
  });

  it('throws for an account without a number', async () => {
    await seedWhatsAppNumber();
    await seedAccount({ accountId: ACCOUNT_ID });
    await expect(registry.openForAccount({ accountId: ACCOUNT_ID })).rejects.toThrow('account has no number');
  });

  it('throws naming the row when a sealed token was copied from another row', async () => {
    await seedWhatsAppNumber();
    await seedWhatsAppNumber({ numberId: OTHER_NUMBER_ID, phoneNumberId: OTHER_PHONE_NUMBER_ID, displayNumber: '5511900000002' });
    await testEnv.CONNECTIONS.prepare(
      'UPDATE whatsapp_numbers SET sealed_access_token = (SELECT sealed_access_token FROM whatsapp_numbers WHERE id = ?) WHERE id = ?',
    )
      .bind(TEST_NUMBER_ID, OTHER_NUMBER_ID)
      .run();
    await expect(registry.openForInbound({ numberId: OTHER_NUMBER_ID })).rejects.toThrow(OTHER_NUMBER_ID);
  });

  it('opens the only number', async () => {
    await seedWhatsAppNumber();
    expect(await registry.openTheOnlyNumber()).toMatchObject({ numberId: TEST_NUMBER_ID, accessToken: TEST_ACCESS_TOKEN });
  });

  it('throws when no number is registered', async () => {
    await expect(registry.openTheOnlyNumber()).rejects.toThrow('no WhatsApp number is registered');
  });

  it('throws when more than one number is registered', async () => {
    await seedWhatsAppNumber();
    await seedWhatsAppNumber({ numberId: OTHER_NUMBER_ID, phoneNumberId: OTHER_PHONE_NUMBER_ID, displayNumber: '5511900000002' });
    await expect(registry.openTheOnlyNumber()).rejects.toThrow('more than one WhatsApp number is registered');
  });
});
