import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { numberRegistryOf } from '../../src/adapters/d1/d1-number-registry';
import { applyDirectoryMigration, seedAccount } from '../support/seed';
import { testEnv } from '../support/workers-env';

const registry = numberRegistryOf({ bindings: testEnv });

async function registerNumber(input: { metaAppRef: string; phoneNumberId: string }): Promise<string> {
  const { numberId } = await registry.registerNumber({
    metaAppRef: input.metaAppRef,
    phoneNumberId: input.phoneNumberId,
    wabaId: 'waba-backfill',
    displayNumber: `55${input.phoneNumberId}`,
    label: input.phoneNumberId,
    accessToken: 'token',
  });
  return numberId;
}

async function homeNumbers(): Promise<(string | null)[]> {
  const { results } = await testEnv.CONNECTIONS.prepare('SELECT id, number_id AS numberId FROM accounts ORDER BY id').all<{
    id: string;
    numberId: string | null;
  }>();
  return results.map((row) => row.numberId);
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('the first-number backfill', () => {
  it('binds every account without a number to the first registered number', async () => {
    await seedAccount({ accountId: 'acc_1' });
    await seedAccount({ accountId: 'acc_2' });
    const { metaAppRef } = await registry.registerMetaApp({ metaAppId: 'meta-1', label: 'one', appSecret: 'secret' });
    const numberId = await registerNumber({ metaAppRef, phoneNumberId: '1000000000010' });
    expect(await homeNumbers()).toEqual([numberId, numberId]);
  });

  it('binds nothing when a second number is registered', async () => {
    const { metaAppRef } = await registry.registerMetaApp({ metaAppId: 'meta-1', label: 'one', appSecret: 'secret' });
    const firstNumberId = await registerNumber({ metaAppRef, phoneNumberId: '1000000000010' });
    await seedAccount({ accountId: 'acc_late' });
    await registerNumber({ metaAppRef, phoneNumberId: '1000000000011' });
    expect(await homeNumbers()).toEqual([null]);
    expect(firstNumberId).toMatch(/^num_/);
  });
});
