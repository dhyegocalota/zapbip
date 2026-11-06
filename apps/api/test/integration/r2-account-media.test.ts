import { afterEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { R2AccountMedia } from '../../src/adapters/r2/r2-account-media';
import { testEnv } from '../support/workers-env';

const LARGE_OBJECT_COUNT = 2_500;
const OTHER_ACCOUNT_OBJECT_COUNT = 3;
const PURGE_TEST_TIMEOUT_MS = 60_000;
const BODY = new Uint8Array([1]);

function purge(): R2AccountMedia {
  return new R2AccountMedia({ bucket: testEnv.MEDIA });
}

async function putAll(input: { prefix: string; count: number }): Promise<void> {
  await Promise.all(Array.from({ length: input.count }, (_, index) => testEnv.MEDIA.put(`${input.prefix}${index}`, BODY)));
}

async function countUnder(input: { prefix: string }): Promise<number> {
  const listing = await testEnv.MEDIA.list({ prefix: input.prefix });
  return listing.objects.length;
}

afterEach(reset);

describe('R2 account media purge', () => {
  it(
    'deletes every object of the account across pages and keeps other accounts',
    async () => {
      await putAll({ prefix: 'accounts/acc1/media/', count: LARGE_OBJECT_COUNT });
      await putAll({ prefix: 'accounts/acc2/media/', count: OTHER_ACCOUNT_OBJECT_COUNT });
      await purge().deleteAll({ accountId: 'acc1' });
      expect(await countUnder({ prefix: 'accounts/acc1/' })).toBe(0);
      expect(await countUnder({ prefix: 'accounts/acc2/' })).toBe(OTHER_ACCOUNT_OBJECT_COUNT);
    },
    PURGE_TEST_TIMEOUT_MS,
  );

  it('deletes nothing for an account without objects', async () => {
    await putAll({ prefix: 'accounts/acc2/media/', count: 1 });
    await expect(purge().deleteAll({ accountId: 'acc1' })).resolves.toBeUndefined();
    expect(await countUnder({ prefix: 'accounts/acc2/' })).toBe(1);
  });

  it('runs twice without failing', async () => {
    await putAll({ prefix: 'accounts/acc1/media/', count: 2 });
    await purge().deleteAll({ accountId: 'acc1' });
    await expect(purge().deleteAll({ accountId: 'acc1' })).resolves.toBeUndefined();
  });

  it('keeps an account whose id starts with the purged id', async () => {
    await putAll({ prefix: 'accounts/acc1/media/', count: 1 });
    await putAll({ prefix: 'accounts/acc10/media/', count: 1 });
    await purge().deleteAll({ accountId: 'acc1' });
    expect(await countUnder({ prefix: 'accounts/acc10/' })).toBe(1);
  });
});
