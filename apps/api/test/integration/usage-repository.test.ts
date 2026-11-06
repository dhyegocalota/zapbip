import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import usageMigrationSql from '../../migrations/0003_usage.sql?raw';
import { D1UsageRepository } from '../../src/adapters/d1/d1-usage-repository';
import { testEnv } from '../support/workers-env';

const DAY = '2026-11-06';
const OTHER_DAY = '2026-11-05';
const FIRST_ACCOUNT = 'acc_1';
const SECOND_ACCOUNT = 'acc_2';

function repository(): D1UsageRepository {
  return new D1UsageRepository({ database: testEnv.CONNECTIONS });
}

async function storedRows(): Promise<{ day: string; account_id: string; gigabyte_seconds: number }[]> {
  const result = await testEnv.CONNECTIONS.prepare(
    'SELECT day, account_id, gigabyte_seconds FROM usage_daily ORDER BY day, account_id',
  ).all<{
    day: string;
    account_id: string;
    gigabyte_seconds: number;
  }>();
  return result.results;
}

beforeEach(async () => {
  await testEnv.CONNECTIONS.prepare(usageMigrationSql).run();
});
afterEach(reset);

describe('D1 usage repository', () => {
  it('reads zero for a day with no rows', async () => {
    expect(await repository().readDayTotal({ day: DAY })).toBe(0);
  });

  it('sums every account for the day', async () => {
    await repository().reportDay({ day: DAY, accountId: FIRST_ACCOUNT, gigabyteSeconds: 1.5 });
    await repository().reportDay({ day: DAY, accountId: SECOND_ACCOUNT, gigabyteSeconds: 2.5 });
    expect(await repository().readDayTotal({ day: DAY })).toBe(4);
  });

  it('leaves another day out of the total', async () => {
    await repository().reportDay({ day: OTHER_DAY, accountId: FIRST_ACCOUNT, gigabyteSeconds: 9 });
    await repository().reportDay({ day: DAY, accountId: FIRST_ACCOUNT, gigabyteSeconds: 1 });
    expect(await repository().readDayTotal({ day: DAY })).toBe(1);
  });

  it('upserts the absolute total for an account and day', async () => {
    await repository().reportDay({ day: DAY, accountId: FIRST_ACCOUNT, gigabyteSeconds: 1 });
    await repository().reportDay({ day: DAY, accountId: FIRST_ACCOUNT, gigabyteSeconds: 3 });
    expect(await storedRows()).toEqual([{ day: DAY, account_id: FIRST_ACCOUNT, gigabyte_seconds: 3 }]);
  });

  it('binds an injection-shaped day instead of executing it', async () => {
    await repository().reportDay({ day: `${DAY}'; DROP TABLE usage_daily; --`, accountId: FIRST_ACCOUNT, gigabyteSeconds: 1 });
    expect(await storedRows()).toHaveLength(1);
  });
});
