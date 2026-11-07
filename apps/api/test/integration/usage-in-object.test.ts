import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { DAY_MS, HOUR_MS } from '@zapbip/types';
import { reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { HISTORY_LIMIT } from '@zapbip/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import usageMigrationSql from '../../migrations/0003_usage.sql?raw';
import { AlarmErrorCode } from '../../src/account-inbox/constants';
import { McpToolName } from '../../src/contract/tool-definitions';
import { USAGE_METER_RETENTION_MS } from '../../src/account-inbox/usage-meter';
import { advanceClock, registerDueTimeProvider } from '../support/inbox-session';
import { applyDirectoryMigration } from '../support/seed';
import { accountInboxStub, connectionOf, testEnv } from '../support/workers-env';
import { callTool, connectClient, seedConnectionWithSecret } from './mcp-fixtures';

const ACCOUNT_ID = 'acc_usage';
const AGENT = 'alpha';
const HOLD_SECONDS = 1;
const FLUSH_DELAY_MS = HOUR_MS + 1;
const BURST_TEST_TIMEOUT_MS = 30_000;
const BURST_CALLS = 999;
const EARLIER_PROVIDER_DELAY_MS = 60_000;
const ZERO_USAGE_DAY = '2026-11-06';
const ISO_DAY_LENGTH = 10;
const UPSERT_TRIGGER_STATEMENTS = ['INSERT', 'UPDATE'].map(
  (operation) =>
    `CREATE TRIGGER usage_upserts_${operation} AFTER ${operation} ON usage_daily BEGIN INSERT INTO usage_upserts (day) VALUES (NEW.day); END`,
);

type MeterRow = { day: string; gigabyteSeconds: number; recordedAt: number };
type DailyRow = { day: string; account_id: string; gigabyte_seconds: number };

let client: Client;

function stub() {
  return accountInboxStub({ accountId: ACCOUNT_ID });
}

async function holdOneSecond(): Promise<void> {
  await callTool({ client, name: McpToolName.WaitForReply, arguments: { timeout_seconds: HOLD_SECONDS } });
}

async function readMeterRow(): Promise<MeterRow> {
  const rows = await runInDurableObject(stub(), (_instance, state) =>
    state.storage.sql
      .exec<MeterRow>('SELECT day, gigabyte_seconds AS gigabyteSeconds, recorded_at AS recordedAt FROM usage_meter')
      .toArray(),
  );
  const [meterRow] = rows;
  if (rows.length !== 1 || meterRow === undefined) throw new Error(`expected one meter row, found ${rows.length}`);
  return meterRow;
}

function readAlarm(): Promise<number | null> {
  return runInDurableObject(stub(), (_instance, state) => state.storage.getAlarm());
}

async function readDailyRows(): Promise<DailyRow[]> {
  const result = await testEnv.CONNECTIONS.prepare('SELECT day, account_id, gigabyte_seconds FROM usage_daily').all<DailyRow>();
  return result.results;
}

async function countUpserts(): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM usage_upserts').first<{ total: number }>();
  if (row === null) throw new Error('count query returned no row');
  return row.total;
}

async function flushDueUsage(): Promise<void> {
  await advanceClock({ stub: stub(), advanceMs: FLUSH_DELAY_MS });
  expect(await runDurableObjectAlarm(stub())).toBe(true);
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await testEnv.CONNECTIONS.prepare(usageMigrationSql).run();
  const connection = await seedConnectionWithSecret({ accountId: ACCOUNT_ID, agent: AGENT });
  client = await connectClient({ secret: connection.secret });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await reset();
});

describe('usage meter in the account object', () => {
  it('adds a resolved call to the day total and arms the alarm at the flush due time', async () => {
    await holdOneSecond();
    const meterRow = await readMeterRow();
    expect(meterRow.gigabyteSeconds).toBeGreaterThan(0);
    expect(await readAlarm()).toBe(meterRow.recordedAt + HOUR_MS);
    expect(await readDailyRows()).toEqual([]);
  });

  it('writes the absolute day total once the flush is due', async () => {
    await holdOneSecond();
    await holdOneSecond();
    await flushDueUsage();
    const meterRow = await readMeterRow();
    expect(await readDailyRows()).toEqual([{ day: meterRow.day, account_id: ACCOUNT_ID, gigabyte_seconds: meterRow.gigabyteSeconds }]);
  });

  it('writes nothing for a second call inside the hour', async () => {
    await holdOneSecond();
    await flushDueUsage();
    const flushedRow = await readMeterRow();
    await holdOneSecond();
    expect(await runDurableObjectAlarm(stub())).toBe(true);
    const meterRow = await readMeterRow();
    expect(meterRow.gigabyteSeconds).toBeGreaterThan(flushedRow.gigabyteSeconds);
    expect(await readDailyRows()).toEqual([{ day: flushedRow.day, account_id: ACCOUNT_ID, gigabyte_seconds: flushedRow.gigabyteSeconds }]);
  });

  it('keeps answering and logs when the flush is rejected', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await testEnv.CONNECTIONS.prepare('DROP TABLE usage_daily').run();
    await holdOneSecond();
    await flushDueUsage();
    const logged = logSpy.mock.calls.map(([line]) => JSON.parse(String(line)));
    expect(logged).toContainEqual(expect.objectContaining({ accountId: ACCOUNT_ID, errorCode: AlarmErrorCode.ProviderFailed }));
    expect(await readAlarm()).not.toBeNull();
  });

  it(
    'writes at most one upsert per hour across a thousand calls and one more after the hour',
    async () => {
      await testEnv.CONNECTIONS.prepare('CREATE TABLE usage_upserts (day TEXT NOT NULL)').run();
      await Promise.all(UPSERT_TRIGGER_STATEMENTS.map((statement) => testEnv.CONNECTIONS.prepare(statement).run()));
      await holdOneSecond();
      const connection = connectionOf({ accountId: ACCOUNT_ID, agent: AGENT });
      await Promise.all(Array.from({ length: BURST_CALLS }, () => stub().getMessages({ connection, limit: HISTORY_LIMIT })));
      expect(await countUpserts()).toBe(0);
      await flushDueUsage();
      const meterRow = await readMeterRow();
      expect(await countUpserts()).toBe(1);
      expect(await readDailyRows()).toEqual([{ day: meterRow.day, account_id: ACCOUNT_ID, gigabyte_seconds: meterRow.gigabyteSeconds }]);
    },
    BURST_TEST_TIMEOUT_MS,
  );

  it('keeps the alarm at an earlier provider and still flushes usage at its own due time', async () => {
    const earlierDueAt = Date.now() + EARLIER_PROVIDER_DELAY_MS;
    await registerDueTimeProvider({ stub: stub(), provider: { nextDueAt: async () => earlierDueAt, runDue: async () => undefined } });
    await holdOneSecond();
    expect(await readAlarm()).toBe(earlierDueAt);
    await flushDueUsage();
    expect(await readDailyRows()).toHaveLength(1);
  });

  it('does not flush a call that measured no gigabyte seconds', async () => {
    await runInDurableObject(stub(), (_instance, state) =>
      state.storage.sql.exec(
        'INSERT INTO usage_meter (day, gigabyte_seconds, flushed_gigabyte_seconds, recorded_at, last_flushed_at) VALUES (?, 0, 0, ?, NULL)',
        ZERO_USAGE_DAY,
        Date.now(),
      ),
    );
    await advanceClock({ stub: stub(), advanceMs: FLUSH_DELAY_MS });
    await runDurableObjectAlarm(stub());
    expect(await readDailyRows()).toEqual([]);
  });

  it('prunes flushed rows older than the retention window and keeps recent ones', async () => {
    const oldDay = new Date(Date.now() - USAGE_METER_RETENTION_MS - DAY_MS).toISOString().slice(0, ISO_DAY_LENGTH);
    await runInDurableObject(stub(), (_instance, state) =>
      state.storage.sql.exec(
        'INSERT INTO usage_meter (day, gigabyte_seconds, flushed_gigabyte_seconds, recorded_at, last_flushed_at) VALUES (?, 1, 1, 0, 0)',
        oldDay,
      ),
    );
    await holdOneSecond();
    await flushDueUsage();
    const remainingDays = await runInDurableObject(stub(), (_instance, state) =>
      state.storage.sql
        .exec<{ day: string }>('SELECT day FROM usage_meter')
        .toArray()
        .map((row) => row.day),
    );
    expect(remainingDays).not.toContain(oldDay);
    expect(remainingDays).toHaveLength(1);
  });
});
