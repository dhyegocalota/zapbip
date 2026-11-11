import { WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { numberRegistryOf } from '../../src/adapters/d1/d1-number-registry';
import { accessTokenAssociatedData } from '../../src/numbers/number-sealing';
import { applyDirectoryMigration, seedAccount } from '../support/seed';
import { testSecretBox } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';

const ACCESS_TOKEN = 'registered-access-token';
const OTHER_ACCESS_TOKEN = 'other-access-token';
const registry = numberRegistryOf({ bindings: testEnv });

type NumberRow = { sealed_access_token: string; state: string; verified_at: number | null; display_number: string };

async function numberRowOf(input: { numberId: string }): Promise<NumberRow> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT * FROM whatsapp_numbers WHERE id = ?').bind(input.numberId).first<NumberRow>();
  if (row === null) throw new Error('number row is missing');
  return row;
}

function numberInput(input: { phoneNumberId: string; accessToken?: string }) {
  const { accessToken = ACCESS_TOKEN } = input;
  return {
    phoneNumberId: input.phoneNumberId,
    wabaId: 'waba-registered',
    displayNumber: `55${input.phoneNumberId}`,
    label: `label ${input.phoneNumberId}`,
    accessToken,
  };
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('registering a number', () => {
  it('seals the access token, and it opens to the plaintext', async () => {
    const { numberId } = await registry.registerNumber(numberInput({ phoneNumberId: '1000000000000010' }));
    const numberRow = await numberRowOf({ numberId });
    expect(numberRow.sealed_access_token).not.toContain(ACCESS_TOKEN);
    const openedAccessToken = await testSecretBox().open({
      sealed: numberRow.sealed_access_token,
      associatedData: accessTokenAssociatedData({ numberId }),
    });
    expect(openedAccessToken).toBe(ACCESS_TOKEN);
    expect((await registry.openForInbound({ numberId })).accessToken).toBe(ACCESS_TOKEN);
  });

  it('registers the number as pending and not verified', async () => {
    const { numberId } = await registry.registerNumber(numberInput({ phoneNumberId: '1000000000000010' }));
    expect(await numberRowOf({ numberId })).toMatchObject({ state: WhatsAppNumberState.Pending, verified_at: null });
  });

  it('refuses a sealed token copied into another row, naming the row id', async () => {
    const first = await registry.registerNumber(numberInput({ phoneNumberId: '1000000000000010' }));
    const second = await registry.registerNumber(numberInput({ phoneNumberId: '1000000000000011', accessToken: OTHER_ACCESS_TOKEN }));
    await testEnv.CONNECTIONS.prepare(
      'UPDATE whatsapp_numbers SET sealed_access_token = (SELECT sealed_access_token FROM whatsapp_numbers WHERE id = ?) WHERE id = ?',
    )
      .bind(first.numberId, second.numberId)
      .run();
    await expect(registry.openForInbound({ numberId: second.numberId })).rejects.toThrow(second.numberId);
  });

  it('finds nothing for unknown phone number ids', async () => {
    expect(await registry.findByPhoneNumberIds({ phoneNumberIds: ['9999999999999999'] })).toEqual([]);
  });

  it('throws for an account without a number', async () => {
    await seedAccount({ accountId: 'acc_without_number' });
    await expect(registry.openForAccount({ accountId: 'acc_without_number' })).rejects.toThrow('account has no number');
  });
});
