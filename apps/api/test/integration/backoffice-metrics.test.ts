import { AccountState, DAY_MS, HOUR_MS, OwnerLocale } from '@zapbip/types';
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import usageMigrationSql from '../../migrations/0003_usage.sql?raw';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { keyedCell, MetricCell, NOT_REPORTED_CLIENT_KEY } from '../../src/backoffice/metrics/metric-cell';
import { NumberFormField } from '../../src/backoffice/numbers/number-form-fields';
import { csrfTokenOf } from '../../src/backoffice/auth/csrf';
import { ActivityMetric } from '../../src/contract/activity-metric';
import { applyMigration, seedAccount, SEED_CREATED_AT } from '../support/seed';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { BACKOFFICE_ORIGIN, requestBackoffice, SESSION_COOKIE } from './backoffice-auth-fixtures';
import { recordingEnvironment } from './backoffice-batch-recorder';
import { endBackofficeSession, getPage, NOW, startBackofficeSession } from './backoffice-numbers-fixtures';

const STATUS_OK = 200;
const STATUS_NOT_FOUND = 404;
const STATUS_SEE_OTHER = 303;
const NUMBER_ALPHA = 'num_alpha';
const NUMBER_BRAVO = 'num_bravo';
const TODAY = '2026-11-07';
const YESTERDAY = '2026-11-06';
const TEN_DAYS_AGO = '2026-10-28';
const FORTY_DAYS_AGO = '2026-09-28';
const BUDGET_BELOW_WARNING = 10_300;
const BUDGET_ABOVE_WARNING = 10_600;
const BLOCKED_PHONE_COUNT = 2;
const OLD_RESTRICTION_AGE_MS = 25 * HOUR_MS;
const NON_GET_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
const copy = BACKOFFICE_COPY[OwnerLocale.PortugueseBrazil];

type ActivitySeed = { day: string; accountId: string; numberId: string | null; metric: ActivityMetric; count: number };

let sessionToken: string;

function cellOf(input: { html: string; cell: string }): string {
  const match = new RegExp(`data-cell="${input.cell}">([^<]*)<`).exec(input.html);
  if (match === null || match[1] === undefined) throw new Error(`cell ${input.cell} is missing`);
  return match[1];
}

async function seedAccountAt(input: { accountId: string; state: AccountState; numberId: string | null; daysAgo: number }): Promise<void> {
  await seedAccount({ accountId: input.accountId, state: input.state, numberId: input.numberId });
  await testEnv.CONNECTIONS.prepare('UPDATE accounts SET created_at = ? WHERE id = ?')
    .bind(NOW - input.daysAgo * DAY_MS, input.accountId)
    .run();
}

async function seedAgent(input: {
  id: string;
  accountId: string;
  clientName: string | null;
  connected: boolean;
  revoked: boolean;
}): Promise<void> {
  await testEnv.CONNECTIONS.prepare(
    'INSERT INTO connections (id, account_id, agent, secret_digest, client_name, first_call_at, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(
      input.id,
      input.accountId,
      input.id,
      `digest-${input.id}`,
      input.clientName,
      input.connected ? SEED_CREATED_AT : null,
      NOW - DAY_MS,
      input.revoked ? NOW : null,
    )
    .run();
}

async function seedActivity(input: { rows: ActivitySeed[] }): Promise<void> {
  await testEnv.CONNECTIONS.batch(
    input.rows.map((row) =>
      testEnv.CONNECTIONS.prepare('INSERT INTO activity_daily (day, account_id, number_id, metric, count) VALUES (?, ?, ?, ?, ?)').bind(
        row.day,
        row.accountId,
        row.numberId,
        row.metric,
        row.count,
      ),
    ),
  );
}

async function seedUsage(input: { gigabyteSeconds: number }): Promise<void> {
  await testEnv.CONNECTIONS.prepare('DELETE FROM usage_daily').run();
  await testEnv.CONNECTIONS.prepare('INSERT INTO usage_daily (day, account_id, gigabyte_seconds) VALUES (?, ?, ?)')
    .bind(TODAY, 'acc_one', input.gigabyteSeconds)
    .run();
}

async function seedUsageOn(input: { day: string; accountId: string; gigabyteSeconds: number }): Promise<void> {
  await testEnv.CONNECTIONS.prepare('INSERT INTO usage_daily (day, account_id, gigabyte_seconds) VALUES (?, ?, ?)')
    .bind(input.day, input.accountId, input.gigabyteSeconds)
    .run();
}

async function seedWorld(): Promise<void> {
  await seedWhatsAppNumber({
    numberId: NUMBER_ALPHA,
    metaAppRef: 'app_alpha',
    phoneNumberId: '1000000000001',
    displayNumber: '5511900000001',
  });
  await seedWhatsAppNumber({
    numberId: NUMBER_BRAVO,
    metaAppRef: 'app_bravo',
    phoneNumberId: '1000000000002',
    displayNumber: '5511900000002',
  });
  await testEnv.CONNECTIONS.prepare('UPDATE whatsapp_numbers SET label = ? WHERE id = ?').bind('Alpha line', NUMBER_ALPHA).run();
  await testEnv.CONNECTIONS.prepare('UPDATE whatsapp_numbers SET label = ? WHERE id = ?').bind('Bravo line', NUMBER_BRAVO).run();
  await seedAccountAt({ accountId: 'acc_one', state: AccountState.Active, numberId: NUMBER_ALPHA, daysAgo: 1 });
  await seedAccountAt({ accountId: 'acc_two', state: AccountState.Waitlisted, numberId: NUMBER_ALPHA, daysAgo: 1 });
  await seedAccountAt({ accountId: 'acc_three', state: AccountState.Suspended, numberId: NUMBER_BRAVO, daysAgo: 40 });
  await seedAccountAt({ accountId: 'acc_four', state: AccountState.Deleting, numberId: NUMBER_BRAVO, daysAgo: 0 });
  await seedAccountAt({ accountId: 'acc_five', state: AccountState.Active, numberId: null, daysAgo: 10 });
  await seedAgent({ id: 'agent_one', accountId: 'acc_one', clientName: 'claude-code', connected: true, revoked: false });
  await seedAgent({ id: 'agent_two', accountId: 'acc_one', clientName: null, connected: false, revoked: false });
  await seedAgent({ id: 'agent_three', accountId: 'acc_three', clientName: 'codex', connected: true, revoked: true });
  await seedActivity({
    rows: [
      { day: TODAY, accountId: 'acc_one', numberId: NUMBER_ALPHA, metric: ActivityMetric.MessagesIn, count: 4 },
      { day: YESTERDAY, accountId: 'acc_one', numberId: NUMBER_ALPHA, metric: ActivityMetric.MessagesIn, count: 6 },
      { day: TEN_DAYS_AGO, accountId: 'acc_one', numberId: NUMBER_ALPHA, metric: ActivityMetric.MessagesIn, count: 10 },
      { day: TODAY, accountId: 'acc_one', numberId: NUMBER_ALPHA, metric: ActivityMetric.MessagesOut, count: 3 },
      { day: TODAY, accountId: 'acc_one', numberId: NUMBER_ALPHA, metric: ActivityMetric.TemplatesSentNotice, count: 2 },
      { day: TODAY, accountId: 'acc_one', numberId: NUMBER_ALPHA, metric: ActivityMetric.TemplatesSentQuestion, count: 1 },
      { day: TODAY, accountId: 'acc_one', numberId: NUMBER_ALPHA, metric: ActivityMetric.SendsFailed, count: 1 },
      { day: TODAY, accountId: 'acc_one', numberId: NUMBER_ALPHA, metric: ActivityMetric.WakesWoken, count: 3 },
      { day: TODAY, accountId: 'acc_one', numberId: NUMBER_ALPHA, metric: ActivityMetric.WakesUnreached, count: 1 },
      { day: TODAY, accountId: 'acc_three', numberId: NUMBER_BRAVO, metric: ActivityMetric.MessagesIn, count: 5 },
      { day: TODAY, accountId: 'acc_three', numberId: NUMBER_BRAVO, metric: ActivityMetric.MessagesOut, count: 2 },
      { day: TODAY, accountId: 'acc_three', numberId: NUMBER_BRAVO, metric: ActivityMetric.WakesWoken, count: 1 },
      { day: TODAY, accountId: 'acc_three', numberId: NUMBER_BRAVO, metric: ActivityMetric.WakesUnreached, count: 1 },
      { day: FORTY_DAYS_AGO, accountId: 'acc_three', numberId: NUMBER_BRAVO, metric: ActivityMetric.MessagesIn, count: 100 },
    ],
  });
  await seedUsage({ gigabyteSeconds: BUDGET_BELOW_WARNING });
  await testEnv.CONNECTIONS.batch([
    testEnv.CONNECTIONS.prepare('INSERT INTO blocked_phones (wa_id, reason, created_at) VALUES (?, ?, ?)').bind(
      '5511911110001',
      'spam',
      NOW,
    ),
    testEnv.CONNECTIONS.prepare('INSERT INTO blocked_phones (wa_id, reason, created_at) VALUES (?, ?, ?)').bind(
      '5511911110002',
      'spam',
      NOW,
    ),
    testEnv.CONNECTIONS.prepare('INSERT INTO channel_restrictions (phone_number_id, error_code, restricted_at) VALUES (?, ?, ?)').bind(
      '1000000000001',
      131_056,
      NOW - DAY_MS / 2,
    ),
    testEnv.CONNECTIONS.prepare('INSERT INTO channel_restrictions (phone_number_id, error_code, restricted_at) VALUES (?, ?, ?)').bind(
      '1000000000002',
      131_056,
      NOW - OLD_RESTRICTION_AGE_MS,
    ),
  ]);
}

async function metricsHtml(input: { query?: string }): Promise<string> {
  const query = input.query === undefined ? '' : input.query;
  const response = await getPage({ path: `/metrics${query}`, sessionToken });
  expect(response.status).toBe(STATUS_OK);
  return response.text();
}

beforeAll(async () => {
  await applyMigration({ sql: usageMigrationSql });
});

beforeEach(async () => {
  await testEnv.CONNECTIONS.batch(
    ['connections', 'activity_daily', 'usage_daily', 'blocked_phones'].map((table) => testEnv.CONNECTIONS.prepare(`DELETE FROM ${table}`)),
  );
  sessionToken = await startBackofficeSession();
});

afterEach(endBackofficeSession);

describe('metrics page figures', () => {
  test('every figure equals its definition across all numbers and thirty days', async () => {
    await seedWorld();
    const html = await metricsHtml({});
    const cell = (name: string) => cellOf({ html, cell: name });
    expect(cell(MetricCell.Accounts)).toBe('5');
    expect(cell(MetricCell.AgentsActive)).toBe('2');
    expect(cell(MetricCell.AgentsConnected)).toBe('1');
    expect(cell(MetricCell.BlockedPhones)).toBe(String(BLOCKED_PHONE_COUNT));
    expect(cell(keyedCell({ cell: MetricCell.AccountState, key: AccountState.Active }))).toBe('2');
    expect(cell(keyedCell({ cell: MetricCell.AccountState, key: AccountState.Waitlisted }))).toBe('1');
    expect(cell(keyedCell({ cell: MetricCell.AccountState, key: AccountState.Suspended }))).toBe('1');
    expect(cell(keyedCell({ cell: MetricCell.AccountState, key: AccountState.Deleting }))).toBe('1');
    expect(cell(keyedCell({ cell: MetricCell.NumberAccounts, key: NUMBER_ALPHA }))).toBe('2');
    expect(cell(keyedCell({ cell: MetricCell.NumberAccounts, key: NUMBER_BRAVO }))).toBe('2');
    expect(cell(keyedCell({ cell: MetricCell.NewAccounts, key: YESTERDAY }))).toBe('2');
    expect(cell(keyedCell({ cell: MetricCell.NewAccounts, key: TODAY }))).toBe('1');
    expect(cell(keyedCell({ cell: MetricCell.AgentClient, key: 'claude-code' }))).toBe('1');
    expect(cell(keyedCell({ cell: MetricCell.AgentClient, key: NOT_REPORTED_CLIENT_KEY }))).toBe('1');
    expect(cell(keyedCell({ cell: MetricCell.AgentsCreated, key: YESTERDAY }))).toBe('3');
    expect(cell(keyedCell({ cell: MetricCell.AgentsRevoked, key: TODAY }))).toBe('1');
    expect(cell(MetricCell.MessagesIn)).toBe('25');
    expect(cell(MetricCell.MessagesOut)).toBe('5');
    expect(cell(MetricCell.TemplatesNotice)).toBe('2');
    expect(cell(MetricCell.TemplatesQuestion)).toBe('1');
    expect(cell(MetricCell.SendsFailed)).toBe('1');
    expect(cell(MetricCell.WakeSuccess)).toBe('66.7%');
    expect(cell(MetricCell.BudgetUsed)).toBe(String(BUDGET_BELOW_WARNING));
    expect(html).toContain(copy[BackofficeCopyKey.MetricsBudgetWithin]);
    expect(html).not.toContain(copy[BackofficeCopyKey.MetricsBudgetWarning]);
  });

  test('lists a restriction inside the time to live and leaves out an older one', async () => {
    await seedWorld();
    const html = await metricsHtml({});
    expect(html).toContain(keyedCell({ cell: MetricCell.Restricted, key: NUMBER_ALPHA }));
    expect(html).not.toContain(keyedCell({ cell: MetricCell.Restricted, key: NUMBER_BRAVO }));
  });

  test('warns at eighty one percent of the daily budget and not at seventy nine', async () => {
    await seedWorld();
    await seedUsage({ gigabyteSeconds: BUDGET_ABOVE_WARNING });
    const html = await metricsHtml({});
    expect(cellOf({ html, cell: MetricCell.BudgetUsed })).toBe(String(BUDGET_ABOVE_WARNING));
    expect(html).toContain(copy[BackofficeCopyKey.MetricsBudgetWarning]);
    expect(html).not.toContain(copy[BackofficeCopyKey.MetricsBudgetWithin]);
  });

  test('draws charts as script-free svg with the values in a native table', async () => {
    await seedWorld();
    const html = await metricsHtml({});
    expect(html).toContain('<svg');
    expect(html).toContain('role="img"');
    expect(html).toContain('<details>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('style="');
  });
});

describe('metrics page filters', () => {
  test('narrows every figure to one number', async () => {
    await seedWorld();
    const html = await metricsHtml({ query: `?number=${NUMBER_ALPHA}` });
    const cell = (name: string) => cellOf({ html, cell: name });
    expect(cell(MetricCell.Accounts)).toBe('2');
    expect(cell(MetricCell.AgentsActive)).toBe('2');
    expect(cell(MetricCell.AgentsConnected)).toBe('1');
    expect(cell(MetricCell.MessagesIn)).toBe('20');
    expect(cell(MetricCell.MessagesOut)).toBe('3');
    expect(cell(MetricCell.WakeSuccess)).toBe('75.0%');
    expect(html).not.toContain(keyedCell({ cell: MetricCell.NumberAccounts, key: NUMBER_BRAVO }));
  });

  test('keeps only the last seven days of activity when the period is seven days', async () => {
    await seedWorld();
    const html = await metricsHtml({ query: '?period=7' });
    expect(cellOf({ html, cell: MetricCell.MessagesIn })).toBe('15');
    expect(html).not.toContain(keyedCell({ cell: MetricCell.MessagesIn, key: TEN_DAYS_AGO }));
  });

  test('offers every registered number in the filter', async () => {
    await seedWorld();
    const html = await metricsHtml({});
    expect(html).toContain(`value="${NUMBER_ALPHA}"`);
    expect(html).toContain('Alpha line');
    expect(html).toContain('Bravo line');
  });
});

describe('metrics page budget', () => {
  beforeEach(async () => {
    await seedWorld();
    await seedUsageOn({ day: YESTERDAY, accountId: 'acc_one', gigabyteSeconds: 4000 });
    await seedUsageOn({ day: YESTERDAY, accountId: 'acc_two', gigabyteSeconds: 1000 });
    await seedUsageOn({ day: TEN_DAYS_AGO, accountId: 'acc_one', gigabyteSeconds: 2000 });
  });

  test('draws one value per day of the period summed across accounts', async () => {
    const html = await metricsHtml({});
    const cell = (day: string) => cellOf({ html, cell: keyedCell({ cell: MetricCell.BudgetUsed, key: day }) });
    expect(cell(YESTERDAY)).toBe('5000');
    expect(cell(TEN_DAYS_AGO)).toBe('2000');
    expect(cell(TODAY)).toBe(String(BUDGET_BELOW_WARNING));
  });

  test('leaves out the days before a seven day period', async () => {
    const html = await metricsHtml({ query: '?period=7' });
    expect(html).toContain(keyedCell({ cell: MetricCell.BudgetUsed, key: YESTERDAY }));
    expect(html).not.toContain(keyedCell({ cell: MetricCell.BudgetUsed, key: TEN_DAYS_AGO }));
  });

  test('ignores the number filter and says so', async () => {
    const html = await metricsHtml({ query: `?number=${NUMBER_ALPHA}` });
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.BudgetUsed, key: YESTERDAY }) })).toBe('5000');
    expect(html).toContain(copy[BackofficeCopyKey.MetricsBudgetAccountWide]);
  });

  test('keeps the budget in the one batch of selects', async () => {
    const { env, batches } = recordingEnvironment();
    await requestBackoffice({ path: '/metrics', cookies: { [SESSION_COOKIE]: sessionToken }, env });
    expect(batches).toHaveLength(1);
    expect(batches[0]!.some((sql) => sql.includes('usage_daily'))).toBe(true);
  });
});

describe('metrics page refused filters', () => {
  test.each(['abc', '90', ''])('redirects the period %j to the canonical page with a notice', async (period) => {
    const response = await getPage({ path: `/metrics?period=${period}`, sessionToken });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('Location')).toBe('/metrics?notice=MetricsPeriodInvalid');
    const followed = await (await getPage({ path: '/metrics?notice=MetricsPeriodInvalid', sessionToken })).text();
    expect(followed).toContain(copy[BackofficeCopyKey.NoticeMetricsPeriodInvalid]);
  });

  test.each(['nope', "num_alpha' OR 1=1"])('redirects the unknown number %j to the unfiltered page with a notice', async (numberId) => {
    await seedWorld();
    const response = await getPage({ path: `/metrics?number=${encodeURIComponent(numberId)}`, sessionToken });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('Location')).toBe('/metrics?notice=MetricsNumberNotFound');
    const followed = await (await getPage({ path: '/metrics?notice=MetricsNumberNotFound', sessionToken })).text();
    expect(followed).toContain(copy[BackofficeCopyKey.NoticeMetricsNumberNotFound]);
  });

  test('keeps the page for a missing period and an empty number', async () => {
    const response = await getPage({ path: '/metrics?number=', sessionToken });
    expect(response.status).toBe(STATUS_OK);
  });
});

describe('metrics page states', () => {
  test('renders zeros and the no data text on an empty database', async () => {
    const html = await metricsHtml({});
    const cell = (name: string) => cellOf({ html, cell: name });
    expect(cell(MetricCell.Accounts)).toBe('0');
    expect(cell(MetricCell.AgentsActive)).toBe('0');
    expect(cell(MetricCell.BlockedPhones)).toBe('0');
    expect(html).toContain(copy[BackofficeCopyKey.MetricsNoData]);
    expect(html).not.toContain('NaN');
  });
});

describe('metrics page is read only', () => {
  test('runs one batch and every statement in it is a select', async () => {
    await seedWorld();
    const { env, batches } = recordingEnvironment();
    const response = await requestBackoffice({ path: '/metrics', cookies: { [SESSION_COOKIE]: sessionToken }, env });
    expect(response.status).toBe(STATUS_OK);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.length).toBeGreaterThan(0);
    batches[0]!.forEach((sql) => expect(sql.trimStart().toUpperCase().startsWith('SELECT')).toBe(true));
  });

  test.each(NON_GET_METHODS)('answers 404 to %s', async (method) => {
    const csrf = await csrfTokenOf({ sessionToken });
    const response = await requestBackoffice({
      path: '/metrics',
      method,
      form: { [NumberFormField.Csrf]: csrf },
      cookies: { [SESSION_COOKIE]: sessionToken },
      headers: { Origin: BACKOFFICE_ORIGIN },
    });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });
});
