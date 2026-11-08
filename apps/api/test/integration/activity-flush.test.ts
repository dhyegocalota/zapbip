import { DAY_MS, HOUR_MS } from '@zapbip/types';
import { reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { USAGE_METER_RETENTION_MS } from '../../src/account-inbox/usage-meter';
import { ActivityMetric } from '../../src/contract/activity-metric';
import { MIDDAY_START, pinClockAt, HALF_AN_HOUR_BEFORE_MIDNIGHT_START } from '../support/pinned-clock';
import { advanceClock, openWindow, registerDueTimeProvider } from '../support/inbox-session';
import { applyDirectoryMigration, seedAccount } from '../support/seed';
import { TEST_NUMBER_ID, seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { accountInboxStub, connectionOf, testEnv } from '../support/workers-env';

type MeterRow = { day: string; metric: ActivityMetric; count: number };
type DailyRow = MeterRow & { account_id: string; number_id: string | null };

const ACCOUNT_ID = 'acc_activity_flush';
const AGENT = 'alpha';
const AGENT_TEXT = 'ola';
const FLUSH_DELAY_MS = HOUR_MS + 1;
const EARLIER_PROVIDER_DELAY_MS = 60_000;
const LATER_PROVIDER_DELAY_MS = 10 * 60_000;
const ISO_DAY_LENGTH = 10;
const OLD_ROW_COUNT = 5;

function stub() {
  return accountInboxStub({ accountId: ACCOUNT_ID });
}

async function sendAgentText(): Promise<void> {
  await stub().sendText({ connection: connectionOf({ accountId: ACCOUNT_ID, agent: AGENT }), text: AGENT_TEXT, replyToMessageId: null });
}

async function recordTwoSends(): Promise<void> {
  await openWindow({ stub: stub() });
  await sendAgentText();
  await sendAgentText();
}

function readMeterRows(): Promise<MeterRow[]> {
  return runInDurableObject(stub(), (_instance, state) =>
    state.storage.sql.exec<MeterRow>('SELECT day, metric, count FROM activity_meter ORDER BY metric').toArray(),
  );
}

async function readDailyRows(): Promise<DailyRow[]> {
  const result = await testEnv.CONNECTIONS.prepare(
    'SELECT day, account_id, number_id, metric, count FROM activity_daily ORDER BY metric',
  ).all<DailyRow>();
  return result.results;
}

function readAlarm(): Promise<number | null> {
  return runInDurableObject(stub(), (_instance, state) => state.storage.getAlarm());
}

async function flushDueActivity(): Promise<number> {
  const offsetMs = await advanceClock({ stub: stub(), advanceMs: FLUSH_DELAY_MS });
  expect(await runDurableObjectAlarm(stub())).toBe(true);
  return offsetMs;
}

beforeEach(async () => {
  pinClockAt({ at: MIDDAY_START });
  await applyDirectoryMigration();
  await seedWhatsAppNumber();
  await seedAccount({ accountId: ACCOUNT_ID, numberId: TEST_NUMBER_ID });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe('activity flush to the directory', () => {
  it('writes the meter to the day row of the account number once the hour has passed', async () => {
    await recordTwoSends();
    expect(await readDailyRows()).toEqual([]);
    await flushDueActivity();
    const meterRows = await readMeterRows();
    expect(meterRows).toContainEqual(expect.objectContaining({ metric: ActivityMetric.MessagesOut, count: 2 }));
    expect(await readDailyRows()).toEqual(meterRows.map((row) => ({ ...row, account_id: ACCOUNT_ID, number_id: TEST_NUMBER_ID })));
  });

  it('does not write again when nothing was recorded after the flush', async () => {
    await recordTwoSends();
    await flushDueActivity();
    await testEnv.CONNECTIONS.prepare('DELETE FROM activity_daily').run();
    await advanceClock({ stub: stub(), advanceMs: FLUSH_DELAY_MS });
    await runDurableObjectAlarm(stub());
    expect(await readDailyRows()).toEqual([]);
  });

  it('replaces the day row with the absolute count when more is recorded after a flush', async () => {
    await recordTwoSends();
    await flushDueActivity();
    await sendAgentText();
    await flushDueActivity();
    expect(await readDailyRows()).toContainEqual(expect.objectContaining({ metric: ActivityMetric.MessagesOut, count: 3 }));
  });

  it('prunes flushed rows older than seven days and keeps recent ones', async () => {
    const oldDay = new Date(Date.now() - USAGE_METER_RETENTION_MS - DAY_MS).toISOString().slice(0, ISO_DAY_LENGTH);
    await runInDurableObject(stub(), (_instance, state) =>
      state.storage.sql.exec(
        'INSERT INTO activity_meter (day, metric, count, flushed_count, recorded_at, last_flushed_at) VALUES (?, ?, ?, ?, 0, 0)',
        oldDay,
        ActivityMetric.MessagesIn,
        OLD_ROW_COUNT,
        OLD_ROW_COUNT,
      ),
    );
    await recordTwoSends();
    await flushDueActivity();
    const meterDays = (await readMeterRows()).map((row) => row.day);
    expect(meterDays).not.toContain(oldDay);
    expect(meterDays.length).toBeGreaterThan(0);
  });

  it('keeps one row per UTC day when the hour of the flush crosses midnight', async () => {
    pinClockAt({ at: HALF_AN_HOUR_BEFORE_MIDNIGHT_START });
    await recordTwoSends();
    await sendAgentText();
    await flushDueActivity();
    const sentRows = (await readDailyRows()).filter((row) => row.metric === ActivityMetric.MessagesOut);
    expect(sentRows.map((row) => row.day)).toEqual(['2030-01-01']);
    expect(sentRows.map((row) => row.count)).toEqual([3]);
  });

  it('keeps the next pending deadline armed after the flush alarm fires', async () => {
    const laterDueAt = Date.now() + FLUSH_DELAY_MS + LATER_PROVIDER_DELAY_MS;
    await registerDueTimeProvider({ stub: stub(), provider: { nextDueAt: async () => laterDueAt, runDue: async () => undefined } });
    await recordTwoSends();
    await runInDurableObject(stub(), (_instance, state) =>
      state.storage.sql.exec('UPDATE usage_meter SET flushed_gigabyte_seconds = gigabyte_seconds'),
    );
    const offsetMs = await flushDueActivity();
    expect(await readAlarm()).toBe(laterDueAt - offsetMs);
  });

  it('keeps the alarm at an earlier provider and still flushes at its own due time', async () => {
    const earlierDueAt = Date.now() + EARLIER_PROVIDER_DELAY_MS;
    await registerDueTimeProvider({ stub: stub(), provider: { nextDueAt: async () => earlierDueAt, runDue: async () => undefined } });
    await recordTwoSends();
    expect(await readAlarm()).toBe(earlierDueAt);
    await flushDueActivity();
    expect((await readDailyRows()).length).toBeGreaterThan(0);
  });
});
