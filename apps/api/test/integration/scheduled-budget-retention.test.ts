import { MEDIA_RETENTION_MS } from '@zapbip/core';
import { DAY_MS, HOUR_MS, OwnerLocale } from '@zapbip/types';
import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import usageMigrationSql from '../../migrations/0003_usage.sql?raw';
import { D1UsageRepository } from '../../src/adapters/d1/d1-usage-repository';
import { LogEvent } from '../../src/contract/log';
import { MEDIA_RETENTION_HOUR, SCHEDULED_CRON } from '../../src/operations/constants';
import { runMediaRetention } from '../../src/operations/media-retention';
import { runScheduled } from '../../src/operations/scheduled';
import { applyDirectoryMigration, seedOwnerIdentity } from '../support/seed';
import { testEnv } from '../support/workers-env';

const NOW = Date.UTC(2026, 10, 6, 12);
const TODAY = '2026-11-06';
const MEDIA_KEY = 'accounts/acc_1/media/med_1';
const MEDIA_SIZE_BYTES = 8;
const DAILY_TICK = Date.UTC(2026, 10, 6, 3);
const ACCOUNTS_SEEDED = 3;

async function seedUsage(input: { totals: number[] }): Promise<void> {
  const repository = new D1UsageRepository({ database: testEnv.CONNECTIONS });
  await Promise.all(
    input.totals.map((gigabyteSeconds, index) => repository.reportDay({ day: TODAY, accountId: `acc_${index}`, gigabyteSeconds })),
  );
}

async function storeMediaObject(): Promise<number> {
  const stored = await testEnv.MEDIA.put(MEDIA_KEY, new Uint8Array(MEDIA_SIZE_BYTES));
  if (stored === null) throw new Error('media object was not stored');
  return stored.uploaded.getTime();
}

function retentionTickAfter(input: { instant: number }): number {
  const nextDayStart = Math.floor(input.instant / DAY_MS) * DAY_MS + DAY_MS;
  return nextDayStart + MEDIA_RETENTION_HOUR * HOUR_MS;
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await testEnv.CONNECTIONS.prepare(usageMigrationSql).run();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe('scheduled budget and retention jobs against seeded data', () => {
  it('logs budget.warning and rejects when the day total reaches the threshold', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await seedUsage({ totals: [6_000, 4_400] });
    await expect(runScheduled({ cron: SCHEDULED_CRON, now: NOW, env: testEnv })).rejects.toThrow(TODAY);
    const logged = logSpy.mock.calls.map(([line]) => JSON.parse(String(line)));
    expect(logged).toContainEqual({ event: LogEvent.BudgetWarning, day: TODAY, gigabyteSeconds: 10_400 });
  });

  it('resolves when the day total is under the threshold', async () => {
    await seedUsage({ totals: [6_000, 4_000] });
    await expect(runScheduled({ cron: SCHEDULED_CRON, now: NOW, env: testEnv })).resolves.toBeUndefined();
  });

  it('deletes a media object once the retention has passed', async () => {
    const uploadedAt = await storeMediaObject();
    await runScheduled({ cron: SCHEDULED_CRON, now: retentionTickAfter({ instant: uploadedAt + MEDIA_RETENTION_MS }), env: testEnv });
    expect(await testEnv.MEDIA.head(MEDIA_KEY)).toBeNull();
  });

  it('keeps a media object that is exactly at the retention', async () => {
    const uploadedAt = await storeMediaObject();
    await runMediaRetention({ bucket: testEnv.MEDIA, now: uploadedAt + MEDIA_RETENTION_MS });
    expect(await testEnv.MEDIA.head(MEDIA_KEY)).not.toBeNull();
  });

  it('runs every job on the daily tick without opening a Durable Object per account', async () => {
    await Promise.all(
      Array.from({ length: ACCOUNTS_SEEDED }, (_unused, index) =>
        seedOwnerIdentity({ accountId: `acc_fan_${index}`, phone: `551190000010${index}`, ownerLocale: OwnerLocale.EnglishUs }),
      ),
    );
    const touchedMembers: string[] = [];
    const watchedInbox = new Proxy(testEnv.ACCOUNT_INBOX, {
      get(target, property) {
        touchedMembers.push(String(property));
        return Reflect.get(target, property);
      },
    });
    await runScheduled({ cron: SCHEDULED_CRON, now: DAILY_TICK, env: { ...testEnv, ACCOUNT_INBOX: watchedInbox } });
    expect(touchedMembers).toEqual([]);
    expect((await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM accounts').first<{ total: number }>())?.total).toBe(
      ACCOUNTS_SEEDED,
    );
  });
});
