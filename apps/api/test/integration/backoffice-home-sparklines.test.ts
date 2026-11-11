import { DAY_MS, OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { writeAudit } from '../../src/backoffice/audit/audit-log';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../../src/backoffice/audit/backoffice-audit-action';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { SPARKLINE_DAYS } from '../../src/backoffice/backoffice-constants';
import { readHomeOverview, SparklineMetric } from '../../src/backoffice/home-sparklines';
import { ActivityMetric } from '../../src/contract/activity-metric';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { backofficeEnv, requestBackoffice, SESSION_COOKIE } from './backoffice-auth-fixtures';
import { recordingEnvironment } from './backoffice-batch-recorder';
import { endBackofficeSession, NOW, startBackofficeSession } from './backoffice-numbers-fixtures';

const STATUS_OK = 200;
const STATUS_SERVER_ERROR = 500;
const EXPECTED_STATEMENTS = 4;
const MANY_NUMBERS = 50;
const MESSAGE_DAY_INDEX = 3;
const WRITE_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|REPLACE)\b/i;
const HOME_TABLES = /whatsapp_numbers|activity_daily|backoffice_audit/;
const copy = BACKOFFICE_COPY[OwnerLocale.EnglishUs];
const ENGLISH = { 'accept-language': 'en-US,en;q=0.9' };

let sessionToken: string;

function dayStart(input: { daysAgo: number }): number {
  return Date.parse(new Date(NOW - input.daysAgo * DAY_MS).toISOString().slice(0, 10));
}

async function seedNumberCreatedAt(input: { index: number; createdAt: number }): Promise<void> {
  const numberId = `num_${input.index}`;
  await seedWhatsAppNumber({
    numberId,
    phoneNumberId: `10000000${String(input.index).padStart(5, '0')}`,
    displayNumber: `5511900${String(input.index).padStart(5, '0')}`,
    state: WhatsAppNumberState.Active,
  });
  await testEnv.CONNECTIONS.prepare('UPDATE whatsapp_numbers SET created_at = ? WHERE id = ?').bind(input.createdAt, numberId).run();
}

function seedActivity(input: { daysAgo: number; accountId: string; metric: ActivityMetric; count: number }): Promise<D1Result> {
  const day = new Date(dayStart({ daysAgo: input.daysAgo })).toISOString().slice(0, 10);
  return testEnv.CONNECTIONS.prepare('INSERT INTO activity_daily (day, account_id, number_id, metric, count) VALUES (?, ?, ?, ?, ?)')
    .bind(day, input.accountId, null, input.metric, input.count)
    .run();
}

function seedAudit(input: { at: number }): Promise<void> {
  return writeAudit({
    database: testEnv.CONNECTIONS,
    entry: {
      now: input.at,
      action: BackofficeAuditAction.SignOut,
      outcome: BackofficeAuditOutcome.Succeeded,
      targetKind: null,
      targetId: null,
      clientAddress: null,
    },
  });
}

function overview(): ReturnType<typeof readHomeOverview> {
  return readHomeOverview({ database: testEnv.CONNECTIONS, now: NOW });
}

beforeEach(async () => {
  sessionToken = await startBackofficeSession();
  await testEnv.CONNECTIONS.batch([
    testEnv.CONNECTIONS.prepare('DELETE FROM activity_daily'),
    testEnv.CONNECTIONS.prepare('DELETE FROM backoffice_audit'),
  ]);
});

afterEach(endBackofficeSession);

describe('the home page data access', () => {
  test('runs one batch of four statements and every one is a select', async () => {
    const { env, batches, prepared } = recordingEnvironment();
    const response = await requestBackoffice({ path: '/', cookies: { [SESSION_COOKIE]: sessionToken }, env });
    expect(response.status).toBe(STATUS_OK);
    expect(batches).toHaveLength(1);
    expect(batches[0]).toHaveLength(EXPECTED_STATEMENTS);
    batches[0]!.forEach((sql) => {
      expect(sql.trimStart().toUpperCase().startsWith('SELECT')).toBe(true);
      expect(sql).not.toMatch(WRITE_KEYWORDS);
    });
    const standalone = prepared.filter((sql) => !batches[0]!.includes(sql));
    expect(standalone.filter((sql) => HOME_TABLES.test(sql))).toEqual([]);
  });

  test('keeps four statements in one batch with many numbers and many days of data', async () => {
    await Promise.all(
      Array.from({ length: MANY_NUMBERS }, (_, index) =>
        seedNumberCreatedAt({ index, createdAt: dayStart({ daysAgo: index % SPARKLINE_DAYS }) }),
      ),
    );
    const { env, batches } = recordingEnvironment();
    await requestBackoffice({ path: '/', cookies: { [SESSION_COOKIE]: sessionToken }, env });
    expect(batches.map((statements) => statements.length)).toEqual([EXPECTED_STATEMENTS]);
  });

  test('answers the existing error page when the batch rejects', async () => {
    const failing = new Proxy(testEnv.CONNECTIONS, {
      get(target, property) {
        if (property === 'batch') return () => Promise.reject(new Error('batch refused'));
        const member = Reflect.get(target, property);
        return typeof member === 'function' ? member.bind(target) : member;
      },
    });
    const response = await requestBackoffice({
      path: '/',
      cookies: { [SESSION_COOKIE]: sessionToken },
      headers: ENGLISH,
      env: backofficeEnv({ overrides: { CONNECTIONS: failing } }),
    });
    expect(response.status).toBe(STATUS_SERVER_ERROR);
    expect(await response.text()).toContain(copy[BackofficeCopyKey.Error500Title]);
  });
});

describe('the home overview series', () => {
  test('are three all-zero series of fourteen days when nothing happened, and the counts still read', async () => {
    const { counts, series } = await overview();
    Object.values(SparklineMetric).forEach((metric) => expect(series[metric]).toEqual(new Array(SPARKLINE_DAYS).fill(0)));
    expect(Object.values(counts).every((count) => count === 0)).toBe(true);
  });

  test('count one number on each of fourteen days, oldest first', async () => {
    await Promise.all(
      Array.from({ length: SPARKLINE_DAYS }, (_, daysAgo) => seedNumberCreatedAt({ index: daysAgo, createdAt: dayStart({ daysAgo }) + 1 })),
    );
    const { series, counts } = await overview();
    expect(series[SparklineMetric.Numbers]).toEqual(new Array(SPARKLINE_DAYS).fill(1));
    expect(counts[WhatsAppNumberState.Active]).toBe(SPARKLINE_DAYS);
  });

  test('add messages in and out on their day and nothing else', async () => {
    await seedActivity({ daysAgo: MESSAGE_DAY_INDEX, accountId: 'acc_one', metric: ActivityMetric.MessagesIn, count: 3 });
    await seedActivity({ daysAgo: MESSAGE_DAY_INDEX, accountId: 'acc_one', metric: ActivityMetric.MessagesOut, count: 2 });
    await seedActivity({ daysAgo: MESSAGE_DAY_INDEX, accountId: 'acc_one', metric: ActivityMetric.SendsFailed, count: 9 });
    const { series } = await overview();
    const messages = series[SparklineMetric.Messages];
    expect(messages).toHaveLength(SPARKLINE_DAYS);
    expect(messages[SPARKLINE_DAYS - 1 - MESSAGE_DAY_INDEX]).toBe(5);
    expect(messages.reduce((total, value) => total + value, 0)).toBe(5);
  });

  test('sum the messages of two accounts on one day', async () => {
    await seedActivity({ daysAgo: 0, accountId: 'acc_one', metric: ActivityMetric.MessagesIn, count: 2 });
    await seedActivity({ daysAgo: 0, accountId: 'acc_two', metric: ActivityMetric.MessagesOut, count: 3 });
    const { series } = await overview();
    expect(series[SparklineMetric.Messages].at(-1)).toBe(5);
  });

  test('count audit entries on the day before now', async () => {
    await seedAudit({ at: NOW - DAY_MS });
    await seedAudit({ at: NOW - DAY_MS });
    const { series } = await overview();
    const audit = series[SparklineMetric.Audit];
    expect(audit.at(-2)).toBe(2);
    expect(audit.reduce((total, value) => total + value, 0)).toBe(2);
  });

  test('include the first millisecond of the oldest day and exclude the day before it', async () => {
    const oldestDayStart = dayStart({ daysAgo: SPARKLINE_DAYS - 1 });
    await seedNumberCreatedAt({ index: 1, createdAt: oldestDayStart });
    await seedNumberCreatedAt({ index: 2, createdAt: oldestDayStart - 1 });
    await seedAudit({ at: oldestDayStart });
    await seedAudit({ at: oldestDayStart - 1 });
    await seedActivity({ daysAgo: SPARKLINE_DAYS - 1, accountId: 'acc_one', metric: ActivityMetric.MessagesIn, count: 4 });
    await seedActivity({ daysAgo: SPARKLINE_DAYS, accountId: 'acc_one', metric: ActivityMetric.MessagesIn, count: 7 });
    const { series } = await overview();
    expect(series[SparklineMetric.Numbers][0]).toBe(1);
    expect(series[SparklineMetric.Audit][0]).toBe(1);
    expect(series[SparklineMetric.Messages][0]).toBe(4);
    Object.values(SparklineMetric).forEach((metric) =>
      expect(series[metric].reduce((total, value) => total + value, 0)).toBeLessThanOrEqual(4),
    );
  });

  test('put the last millisecond of a day and the first of the next on two different days', async () => {
    const yesterdayEnd = dayStart({ daysAgo: 0 }) - 1;
    await seedAudit({ at: yesterdayEnd });
    await seedAudit({ at: yesterdayEnd + 1 });
    const { series } = await overview();
    expect(series[SparklineMetric.Audit].slice(-2)).toEqual([1, 1]);
  });
});
