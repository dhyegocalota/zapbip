import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { HOUR_MS } from '@zapbip/types';
import { reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import usageMigrationSql from '../../migrations/0003_usage.sql?raw';
import { AlarmErrorCode } from '../../src/account-inbox/constants';
import { McpToolName } from '../../src/contract/tool-definitions';
import { advanceClock } from '../support/inbox-session';
import { applyDirectoryMigration } from '../support/seed';
import { accountInboxStub, testEnv } from '../support/workers-env';
import { callTool, connectClient, seedConnectionWithSecret } from './mcp-fixtures';

const ACCOUNT_ID = 'acc_usage';
const AGENT = 'alpha';
const HOLD_SECONDS = 1;
const FLUSH_DELAY_MS = HOUR_MS + 1;

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
});
