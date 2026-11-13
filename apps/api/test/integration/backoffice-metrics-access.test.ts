import { AccountState, DAY_MS, OwnerLocale } from '@zapbip/types';
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import usageMigrationSql from '../../migrations/0003_usage.sql?raw';
import { ActivityMetric } from '../../src/contract/activity-metric';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { keyedCell, MetricCell } from '../../src/backoffice/metrics/metric-cell';
import { seedInvite, seedWaitlistEntry } from '../support/access';
import { applyMigration, seedAccount } from '../support/seed';
import { resetWaitlist } from '../support/waitlist';
import { testEnv } from '../support/workers-env';
import { endBackofficeSession, getPage, NOW, startBackofficeSession } from './backoffice-numbers-fixtures';
import { recordingEnvironment } from './backoffice-batch-recorder';
import { requestBackoffice, SESSION_COOKIE } from './backoffice-auth-fixtures';

const TODAY = '2026-11-07';
const THREE_DAYS_AGO = '2026-11-04';
const TWENTY_DAYS_AGO = '2026-10-18';
const FORTY_DAYS_AGO = '2026-09-28';

let sessionToken: string;

function cellOf(input: { html: string; cell: string }): string {
  const match = new RegExp(`data-cell="${input.cell}">([^<]*)<`).exec(input.html);
  if (match === null || match[1] === undefined) throw new Error(`cell ${input.cell} is missing`);
  return match[1];
}

async function seedActivity(input: { day: string; metric: ActivityMetric; count: number; accountId?: string }): Promise<void> {
  const { day, metric, count, accountId = 'acc_one' } = input;
  await testEnv.CONNECTIONS.prepare('INSERT INTO activity_daily (day, account_id, number_id, metric, count) VALUES (?, ?, NULL, ?, ?)')
    .bind(day, accountId, metric, count)
    .run();
}

async function seedReleased(input: { accountId: string; daysAgo: number; hasAgent: boolean }): Promise<void> {
  await seedAccount({ accountId: input.accountId, state: AccountState.Active });
  await testEnv.CONNECTIONS.prepare('UPDATE accounts SET released_at = ? WHERE id = ?')
    .bind(NOW - input.daysAgo * DAY_MS, input.accountId)
    .run();
  if (!input.hasAgent) return;
  await testEnv.CONNECTIONS.prepare('INSERT INTO connections (id, account_id, agent, secret_digest, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(`conn_${input.accountId}`, input.accountId, `agent_${input.accountId}`, `digest_${input.accountId}`, NOW)
    .run();
}

async function seedWorld(): Promise<void> {
  await seedWaitlistEntry({ email: 'a@example.com', locale: OwnerLocale.EnglishUs, createdAt: NOW - 1 * DAY_MS });
  await seedWaitlistEntry({ email: 'b@example.com', locale: OwnerLocale.PortugueseBrazil, createdAt: NOW - 3 * DAY_MS });
  await seedWaitlistEntry({ email: 'c@example.com', locale: OwnerLocale.PortugueseBrazil, createdAt: NOW - 20 * DAY_MS });
  await seedWaitlistEntry({ email: 'd@example.com', locale: OwnerLocale.PortugueseBrazil, createdAt: NOW - 40 * DAY_MS });
  await seedInvite({ email: 'a@example.com', digest: 'i1', createdAt: NOW - 2 * DAY_MS, expiresAt: NOW + DAY_MS, usedAt: NOW - DAY_MS });
  await seedInvite({ email: 'b@example.com', digest: 'i2', createdAt: NOW - 20 * DAY_MS, expiresAt: NOW - DAY_MS });
  await seedInvite({ email: 'c@example.com', digest: 'i3', createdAt: NOW - 40 * DAY_MS, expiresAt: NOW - 10 * DAY_MS });
  await seedReleased({ accountId: 'rel_recent_agent', daysAgo: 2, hasAgent: true });
  await seedReleased({ accountId: 'rel_recent_bare', daysAgo: 3, hasAgent: false });
  await seedReleased({ accountId: 'rel_old_agent', daysAgo: 20, hasAgent: true });
  await seedReleased({ accountId: 'rel_ancient', daysAgo: 60, hasAgent: false });
  await seedActivity({ day: TODAY, metric: ActivityMetric.MessagesIn, count: 4 });
  await seedActivity({ day: THREE_DAYS_AGO, metric: ActivityMetric.MessagesOut, count: 3 });
  await seedActivity({ day: TWENTY_DAYS_AGO, metric: ActivityMetric.MessagesIn, count: 10 });
  await seedActivity({ day: FORTY_DAYS_AGO, metric: ActivityMetric.MessagesIn, count: 100 });
  await seedActivity({ day: TODAY, metric: ActivityMetric.QuestionsAnswered, count: 2 });
  await seedActivity({ day: TWENTY_DAYS_AGO, metric: ActivityMetric.QuestionsAnswered, count: 5 });
}

beforeAll(async () => {
  await applyMigration({ sql: usageMigrationSql });
});

beforeEach(async () => {
  await testEnv.CONNECTIONS.batch([
    testEnv.CONNECTIONS.prepare('DELETE FROM activity_daily'),
    testEnv.CONNECTIONS.prepare('DELETE FROM connections'),
  ]);
  sessionToken = await startBackofficeSession();
  await resetWaitlist();
});

afterEach(() => endBackofficeSession());

describe('the access metrics', () => {
  test('counts the waitlist in total, by language and in the last 7 and 30 days', async () => {
    await seedWorld();
    const html = await (await getPage({ path: '/metrics', sessionToken })).text();
    expect(cellOf({ html, cell: MetricCell.AccessWaitlistTotal })).toBe('4');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessWaitlistLocale, key: OwnerLocale.PortugueseBrazil }) })).toBe('3');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessWaitlistLocale, key: OwnerLocale.EnglishUs }) })).toBe('1');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessJoins, key: '7' }) })).toBe('2');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessJoins, key: '30' }) })).toBe('3');
  });

  test('counts invites issued and used in total and per window', async () => {
    await seedWorld();
    const html = await (await getPage({ path: '/metrics', sessionToken })).text();
    expect(cellOf({ html, cell: MetricCell.AccessInvitedTotal })).toBe('3');
    expect(cellOf({ html, cell: MetricCell.AccessInvitesUsedTotal })).toBe('1');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessInvited, key: '7' }) })).toBe('1');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessInvited, key: '30' }) })).toBe('2');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessInvitesUsed, key: '7' }) })).toBe('1');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessInvitesUsed, key: '30' }) })).toBe('1');
  });

  test('counts released accounts and how many of them connected an agent', async () => {
    await seedWorld();
    const html = await (await getPage({ path: '/metrics', sessionToken })).text();
    expect(cellOf({ html, cell: MetricCell.AccessReleasedTotal })).toBe('4');
    expect(cellOf({ html, cell: MetricCell.AccessReleasedConnectedTotal })).toBe('2');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessReleased, key: '7' }) })).toBe('2');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessReleased, key: '30' }) })).toBe('3');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessReleasedConnected, key: '7' }) })).toBe('1');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessReleasedConnected, key: '30' }) })).toBe('2');
  });

  test('counts messages and answered questions per window, leaving out older days', async () => {
    await seedWorld();
    const html = await (await getPage({ path: '/metrics', sessionToken })).text();
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessMessages, key: '7' }) })).toBe('7');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessMessages, key: '30' }) })).toBe('17');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessQuestions, key: '7' }) })).toBe('2');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessQuestions, key: '30' }) })).toBe('7');
  });

  test('says the access figures cover every number', async () => {
    await seedWorld();
    const html = await (await getPage({ path: '/metrics', sessionToken })).text();
    expect(html).toContain(BACKOFFICE_COPY[OwnerLocale.PortugueseBrazil][BackofficeCopyKey.MetricsAccessGlobalNote]);
  });

  test('shows the one empty state and no NaN on an empty database', async () => {
    const response = await getPage({ path: '/metrics', sessionToken });
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).not.toContain(`data-cell="${MetricCell.AccessWaitlistTotal}"`);
    expect(html).not.toContain('NaN');
  });

  test('shows the access section with zeros once any waitlist entry exists', async () => {
    await seedWaitlistEntry({ email: 'a@example.com', createdAt: NOW - 90 * DAY_MS });
    const html = await (await getPage({ path: '/metrics', sessionToken })).text();
    expect(cellOf({ html, cell: MetricCell.AccessWaitlistTotal })).toBe('1');
    expect(cellOf({ html, cell: MetricCell.AccessReleasedTotal })).toBe('0');
    expect(cellOf({ html, cell: keyedCell({ cell: MetricCell.AccessJoins, key: '30' }) })).toBe('0');
    expect(html).not.toContain('NaN');
  });

  test('stays in the one batch of selects', async () => {
    await seedWorld();
    const { env, batches } = recordingEnvironment();
    const response = await requestBackoffice({ path: '/metrics', cookies: { [SESSION_COOKIE]: sessionToken }, env });
    expect(response.status).toBe(200);
    expect(batches).toHaveLength(1);
    expect(batches[0]!.some((sql) => sql.includes('waitlist_invites'))).toBe(true);
    batches[0]!.forEach((sql) => expect(sql.trimStart().toUpperCase().startsWith('SELECT')).toBe(true));
  });
});
