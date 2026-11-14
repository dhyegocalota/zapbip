import { ACCESS_BATCH_LIMIT, AccountState, DAY_MS, HttpStatus, OwnerLocale } from '@zapbip/types';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import usageMigrationSql from '../../migrations/0003_usage.sql?raw';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../../src/backoffice/audit/backoffice-audit-action';
import { RETRY_AFTER_SECONDS } from '../../src/backoffice/auth/rate-limit';
import { maskedPhoneOf } from '@zapbip/core';
import {
  OPERATOR_KEY_LAST_USED_INTERVAL_MS,
  OPERATOR_MCP_AUDIT_LIMIT,
  OPERATOR_MCP_ID_MAX_LENGTH,
  OPERATOR_MCP_MAX_IDS,
  OPERATOR_MCP_MAX_OFFSET,
} from '../../src/backoffice/operator-mcp/operator-mcp-constants';
import { OperatorToolName } from '../../src/backoffice/operator-mcp/operator-tool-name';
import { ActivityMetric } from '../../src/contract/activity-metric';
import { CONNECTION_SECRET_PREFIX, UNAUTHORIZED_BODY } from '../../src/contract/constants';
import { captureLogLines } from '../support/capture-log-lines';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import { seedInvite, seedWaitingAccount, seedWaitlistEntry, stateOfAccount } from '../support/access';
import { callOperatorTool, operatorKeyRows, requestOperatorMcp, seedOperatorKey } from '../support/operator-keys';
import { applyMigration, seedAccount } from '../support/seed';
import { resetWaitlist } from '../support/waitlist';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { testEnv } from '../support/workers-env';
import { backofficeEnv, BACKOFFICE_ORIGIN, CLIENT_ADDRESS, requestBackoffice, SESSION_COOKIE } from './backoffice-auth-fixtures';
import { endBackofficeSession, NOW, startBackofficeSession } from './backoffice-numbers-fixtures';
import { recordingEnvironment } from './backoffice-batch-recorder';
import { postMcp, seedConnectionWithSecret } from './mcp-fixtures';

const STATUS_BAD_REQUEST = 400;
const FIRST_PHONE = '5511911110001';
const SECOND_PHONE = '5511911110002';
const START_DISPLAY_NUMBER = '+5511977770000';
const EXPECTED_TOOLS = [
  OperatorToolName.MetricsSummary,
  OperatorToolName.ListWaitlist,
  OperatorToolName.ListWaitingAccounts,
  OperatorToolName.ReleaseAccess,
  OperatorToolName.InviteWaitlist,
  OperatorToolName.ListAudit,
];
const UNAUTHORIZED_TEXT = JSON.stringify(UNAUTHORIZED_BODY);

let key: string;
let keyId: string;

async function auditRows(input: {
  action: BackofficeAuditAction;
}): Promise<{ outcome: string; target_id: string; actor_key_id: string | null; client_address: string | null }[]> {
  const { results } = await testEnv.CONNECTIONS.prepare(
    'SELECT outcome, target_id, actor_key_id, client_address FROM backoffice_audit WHERE action = ? ORDER BY at, rowid',
  )
    .bind(input.action)
    .all<{ outcome: string; target_id: string; actor_key_id: string | null; client_address: string | null }>();
  return results;
}

function call(input: { name: OperatorToolName; arguments?: Record<string, unknown> }) {
  return callOperatorTool({ bearer: key, ...input });
}

async function seedTwoWaiting(): Promise<void> {
  await seedWaitingAccount({
    accountId: 'acct_first',
    phone: FIRST_PHONE,
    locale: OwnerLocale.PortugueseBrazil,
    createdAt: NOW - 2 * DAY_MS,
  });
  await seedWaitingAccount({ accountId: 'acct_second', phone: SECOND_PHONE, locale: OwnerLocale.EnglishUs, createdAt: NOW - DAY_MS });
}

beforeAll(async () => {
  await applyMigration({ sql: usageMigrationSql });
});

beforeEach(async () => {
  await testEnv.CONNECTIONS.batch([
    testEnv.CONNECTIONS.prepare('DELETE FROM backoffice_agent_keys'),
    testEnv.CONNECTIONS.prepare('DELETE FROM owner_identities'),
    testEnv.CONNECTIONS.prepare('DELETE FROM activity_daily'),
    testEnv.CONNECTIONS.prepare('DELETE FROM connections'),
  ]);
  await startBackofficeSession();
  await resetWaitlist();
  await seedWhatsAppNumber({ displayNumber: START_DISPLAY_NUMBER });
  ({ key, keyId } = await seedOperatorKey({ label: 'test agent', createdAt: NOW, expiresAt: NOW + DAY_MS }));
});

afterEach(() => {
  endBackofficeSession();
  vi.restoreAllMocks();
});

describe('the operator endpoint refuses', () => {
  test('a call without a key', async () => {
    const response = await requestOperatorMcp({ body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(await response.text()).toBe(UNAUTHORIZED_TEXT);
  });

  test.each(['zbo_short', 'not-a-key', '', 'zbo_0000000000000000_' + 'A'.repeat(43)])(
    'the bearer %j with the same bytes',
    async (bearer) => {
      const response = await requestOperatorMcp({ bearer, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
      expect(response.status).toBe(HttpStatus.Unauthorized);
      expect(await response.text()).toBe(UNAUTHORIZED_TEXT);
    },
  );

  test('a right key id with a wrong secret', async () => {
    const forged = `${key.slice(0, key.length - 1)}${key.endsWith('A') ? 'B' : 'A'}`;
    const response = await requestOperatorMcp({ bearer: forged, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    expect(response.status).toBe(HttpStatus.Unauthorized);
    expect(await response.text()).toBe(UNAUTHORIZED_TEXT);
  });

  test('a revoked key', async () => {
    const revoked = await seedOperatorKey({ createdAt: NOW, expiresAt: NOW + DAY_MS, revokedAt: NOW - 1 });
    const response = await requestOperatorMcp({ bearer: revoked.key, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    expect(response.status).toBe(HttpStatus.Unauthorized);
  });

  test('an expired key, also at the instant of its expiry', async () => {
    const expired = await seedOperatorKey({ createdAt: NOW - DAY_MS, expiresAt: NOW });
    const response = await requestOperatorMcp({ bearer: expired.key, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    expect(response.status).toBe(HttpStatus.Unauthorized);
  });

  test('a key revoked in the middle of its use on the very next call', async () => {
    expect((await call({ name: OperatorToolName.ListAudit })).isError).toBe(false);
    await testEnv.CONNECTIONS.prepare('UPDATE backoffice_agent_keys SET revoked_at = ? WHERE id = ?').bind(NOW, keyId).run();
    const response = await requestOperatorMcp({ bearer: key, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    expect(response.status).toBe(HttpStatus.Unauthorized);
  });

  test('a signed-in session cookie, because the endpoint uses no cookies', async () => {
    const sessionToken = await startBackofficeSession();
    const response = await requestOperatorMcp({
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      headers: { Cookie: `${SESSION_COOKIE}=${sessionToken}` },
    });
    expect(response.status).toBe(HttpStatus.Unauthorized);
  });

  test('a product connection secret as the bearer', async () => {
    const connection = await seedConnectionWithSecret({ accountId: 'acc_product', agent: 'alpha' });
    expect(connection.secret.startsWith(CONNECTION_SECRET_PREFIX)).toBe(true);
    const response = await requestOperatorMcp({ bearer: connection.secret, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    expect(response.status).toBe(HttpStatus.Unauthorized);
  });

  test.each(['GET', 'DELETE', 'PUT'])('the %s method with 405 and no cross-origin headers', async (method) => {
    const response = await requestOperatorMcp({ method, bearer: key, headers: { Origin: 'https://evil.example' } });
    expect(response.status).toBe(HttpStatus.MethodNotAllowed);
    expect(response.headers.get('Allow')).toBe('POST');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  test('a preflight request without answering any cross-origin permission', async () => {
    const response = await requestOperatorMcp({
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
    });
    expect(response.status).toBe(HttpStatus.MethodNotAllowed);
    expect([...response.headers.keys()].filter((name) => name.startsWith('access-control'))).toEqual([]);
  });

  test('a JSON-RPC batch', async () => {
    const response = await requestOperatorMcp({ bearer: key, body: [{ jsonrpc: '2.0', id: 1, method: 'tools/list' }] });
    expect(response.status).toBe(STATUS_BAD_REQUEST);
  });

  test('the host with a trailing dot, the product host and the per-connection path', async () => {
    const trailingDot = await requestOperatorMcp({
      bearer: key,
      origin: 'http://backoffice.localhost.:8787',
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(trailingDot.status).toBe(HttpStatus.NotFound);
    expect((await postMcp({ path: '/mcp', bearer: key })).status).toBe(HttpStatus.Unauthorized);
    const perConnection = await requestBackoffice({ path: `/c/${key}/mcp`, method: 'POST', form: {} });
    expect(perConnection.status).toBe(HttpStatus.NotFound);
  });
});

describe('the operator endpoint', () => {
  test('lists exactly the six tools, each describing its limits, and none that delete, connect or touch credentials', async () => {
    const response = await requestOperatorMcp({ bearer: key, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    const { result } = (await response.json()) as { result: { tools: { name: string; description: string }[] } };
    expect(result.tools.map((tool) => tool.name).sort()).toEqual([...EXPECTED_TOOLS].sort());
    const writing = result.tools.filter((tool) =>
      [OperatorToolName.ReleaseAccess, OperatorToolName.InviteWaitlist].includes(tool.name as OperatorToolName),
    );
    writing.forEach((tool) => expect(tool.description).toContain('confirm'));
  });

  test('says on initialize that deleting accounts, connecting numbers and credentials stay with a human', async () => {
    const response = await requestOperatorMcp({
      bearer: key,
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
      },
    });
    const { result } = (await response.json()) as { result: { instructions: string } };
    expect(result.instructions).toMatch(/human/i);
    expect(result.instructions).toMatch(/delet/i);
  });

  test('stamps the last use once per interval', async () => {
    await call({ name: OperatorToolName.ListAudit });
    const [first] = await operatorKeyRows();
    expect(first?.last_used_at).toBe(NOW);
    vi.setSystemTime(NOW + OPERATOR_KEY_LAST_USED_INTERVAL_MS / 2);
    await call({ name: OperatorToolName.ListAudit });
    expect((await operatorKeyRows())[0]?.last_used_at).toBe(NOW);
    vi.setSystemTime(NOW + OPERATOR_KEY_LAST_USED_INTERVAL_MS);
    await call({ name: OperatorToolName.ListAudit });
    expect((await operatorKeyRows())[0]?.last_used_at).toBe(NOW + OPERATOR_KEY_LAST_USED_INTERVAL_MS);
  });

  test('limits each key on its own and answers 429 with Retry-After', async () => {
    const limiter = createFakeRateLimiter({ limit: 2 });
    const env = backofficeEnv({ overrides: { OPERATOR_KEY_RATE_LIMITER: limiter } });
    const other = await seedOperatorKey({ createdAt: NOW, expiresAt: NOW + DAY_MS });
    const statuses = await Promise.all(
      [1, 2, 3].map(
        async () => (await requestOperatorMcp({ bearer: key, env, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } })).status,
      ),
    );
    expect(statuses.sort()).toEqual([HttpStatus.Ok, HttpStatus.Ok, HttpStatus.TooManyRequests]);
    const otherResponse = await requestOperatorMcp({ bearer: other.key, env, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    expect(otherResponse.status).toBe(HttpStatus.Ok);
    expect(new Set(limiter.calls)).toEqual(new Set([keyId, other.keyId]));
    const limited = await requestOperatorMcp({ bearer: key, env, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    expect(limited.headers.get('Retry-After')).toBe(RETRY_AFTER_SECONDS);
  });

  test('logs neither the key nor its digest', async () => {
    const lines = captureLogLines();
    await call({ name: OperatorToolName.ListAudit });
    await call({ name: OperatorToolName.ReleaseAccess, arguments: { accountIds: ['acct_missing'], confirm: true } });
    await requestOperatorMcp({ bearer: `${key}x`, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    const [row] = await operatorKeyRows();
    expect(lines.join('\n')).not.toContain(key);
    expect(lines.join('\n')).not.toContain(row?.key_digest);
  });
});

describe('metrics_summary', () => {
  test('reports the access figures of the metrics page for the 7 and 30 day windows', async () => {
    await seedWaitlistEntry({ email: 'a@example.com', createdAt: NOW - DAY_MS });
    await seedWaitlistEntry({ email: 'b@example.com', createdAt: NOW - 3 * DAY_MS });
    await seedWaitlistEntry({ email: 'c@example.com', createdAt: NOW - 20 * DAY_MS });
    await seedWaitlistEntry({ email: 'd@example.com', createdAt: NOW - 40 * DAY_MS });
    await seedInvite({ email: 'a@example.com', digest: 'i1', createdAt: NOW - 2 * DAY_MS, expiresAt: NOW + DAY_MS, usedAt: NOW - DAY_MS });
    await seedInvite({ email: 'b@example.com', digest: 'i2', createdAt: NOW - 20 * DAY_MS, expiresAt: NOW - DAY_MS });
    await seedAccount({ accountId: 'rel_recent', state: AccountState.Active });
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET released_at = ? WHERE id = ?')
      .bind(NOW - 2 * DAY_MS, 'rel_recent')
      .run();
    await seedAccount({ accountId: 'rel_old', state: AccountState.Active });
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET released_at = ? WHERE id = ?')
      .bind(NOW - 20 * DAY_MS, 'rel_old')
      .run();
    await seedWaitingAccount({ accountId: 'acct_waiting', phone: FIRST_PHONE, createdAt: NOW });
    const insertActivity = testEnv.CONNECTIONS.prepare(
      'INSERT INTO activity_daily (day, account_id, number_id, metric, count) VALUES (?, ?, NULL, ?, ?)',
    );
    await testEnv.CONNECTIONS.batch([
      insertActivity.bind('2026-11-07', 'acc_one', ActivityMetric.MessagesIn, 4),
      insertActivity.bind('2026-10-18', 'acc_one', ActivityMetric.MessagesOut, 10),
      insertActivity.bind('2026-11-07', 'acc_one', ActivityMetric.QuestionsAnswered, 2),
    ]);
    const { structured, isError } = await call({ name: OperatorToolName.MetricsSummary });
    expect(isError).toBe(false);
    expect(structured).toMatchObject({
      accountsByState: { [AccountState.Waitlisted]: 1, [AccountState.Active]: 2 },
      access: {
        waitlistTotal: 4,
        invites: { issued: 2, used: 1 },
        releasedAllTime: { released: 2, connected: 0 },
        windows: {
          sevenDays: { joins: 2, invited: 1, used: 1, released: 1, messages: 4, questions: 2 },
          thirtyDays: { joins: 3, invited: 2, used: 1, released: 2, messages: 14, questions: 2 },
        },
      },
    });
  });
});

describe('list_waitlist', () => {
  beforeEach(async () => {
    await seedWaitlistEntry({ email: 'old@example.com', locale: OwnerLocale.PortugueseBrazil, createdAt: NOW - 3 * DAY_MS });
    await seedWaitlistEntry({ email: 'mid@example.com', locale: OwnerLocale.EnglishUs, createdAt: NOW - 2 * DAY_MS });
    await seedWaitlistEntry({ email: 'new@example.com', locale: OwnerLocale.PortugueseBrazil, createdAt: NOW - DAY_MS });
  });

  test('lists the entries the Access page offers to invite, oldest first, with the total and the language only', async () => {
    await seedWaitlistEntry({ email: 'live@example.com', createdAt: NOW - DAY_MS });
    await seedInvite({ email: 'live@example.com', digest: 'live', createdAt: NOW, expiresAt: NOW + DAY_MS });
    await seedWaitlistEntry({ email: 'used@example.com', createdAt: NOW - DAY_MS });
    await seedInvite({
      email: 'used@example.com',
      digest: 'used',
      createdAt: NOW - 2 * DAY_MS,
      expiresAt: NOW - DAY_MS,
      usedAt: NOW - DAY_MS,
    });
    const { structured, text } = await call({ name: OperatorToolName.ListWaitlist });
    expect(structured).toMatchObject({
      total: 3,
      entries: [
        { entryId: 'old@example.com', locale: OwnerLocale.PortugueseBrazil },
        { entryId: 'mid@example.com' },
        { entryId: 'new@example.com' },
      ],
    });
    expect((structured as { entries: unknown[] }).entries).toHaveLength(3);
    expect(text).not.toContain('creditedCount');
    expect(text).not.toContain('live@example.com');
    expect(text).not.toContain('used@example.com');
  });

  test('pages with a limit and an offset', async () => {
    const { structured } = await call({ name: OperatorToolName.ListWaitlist, arguments: { limit: 1, offset: 1 } });
    expect(structured).toMatchObject({ total: 3, entries: [{ entryId: 'mid@example.com' }] });
  });

  test('filters by language and by the day people joined', async () => {
    const portuguese = await call({ name: OperatorToolName.ListWaitlist, arguments: { locale: OwnerLocale.PortugueseBrazil } });
    expect(portuguese.structured).toMatchObject({ total: 2 });
    const day = new Date(NOW - 2 * DAY_MS).toISOString().slice(0, 10);
    const dated = await call({ name: OperatorToolName.ListWaitlist, arguments: { from: day, to: day } });
    expect(dated.structured).toMatchObject({ total: 1, entries: [{ entryId: 'mid@example.com' }] });
  });

  test('writes one audit row per call under the key, with the page range', async () => {
    await call({ name: OperatorToolName.ListWaitlist, arguments: { limit: 1, offset: 1 } });
    await call({ name: OperatorToolName.ListWaitlist });
    expect(await auditRows({ action: BackofficeAuditAction.WaitlistListed })).toEqual([
      {
        outcome: BackofficeAuditOutcome.Succeeded,
        target_id: 'offset=1 limit=1 returned=1',
        actor_key_id: keyId,
        client_address: CLIENT_ADDRESS,
      },
      {
        outcome: BackofficeAuditOutcome.Succeeded,
        target_id: 'offset=0 limit=20 returned=3',
        actor_key_id: keyId,
        client_address: CLIENT_ADDRESS,
      },
    ]);
  });

  test('says in its description that it lists only people not yet invited and that each call is audited', async () => {
    const response = await requestOperatorMcp({ bearer: key, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    const { result } = (await response.json()) as { result: { tools: { name: string; description: string }[] } };
    const description = result.tools.find((tool) => tool.name === OperatorToolName.ListWaitlist)?.description;
    expect(description).toContain('invite');
    expect(description).toContain('audit');
  });

  test.each([
    { limit: 0 },
    { limit: 100_000 },
    { offset: -1 },
    { offset: OPERATOR_MCP_MAX_OFFSET + 1 },
    { locale: 'xx' },
    { from: 'yesterday' },
  ])('refuses the arguments %j and audits nothing', async (arguments_) => {
    expect((await call({ name: OperatorToolName.ListWaitlist, arguments: arguments_ })).isError).toBe(true);
    expect(await auditRows({ action: BackofficeAuditAction.WaitlistListed })).toEqual([]);
  });
});

describe('list_waiting_accounts', () => {
  test('lists waitlisted accounts oldest first with a masked phone and never the full number', async () => {
    await seedTwoWaiting();
    await seedWaitingAccount({ accountId: 'acct_active', phone: '5511911110003', state: AccountState.Active, createdAt: NOW });
    const { structured, text } = await call({ name: OperatorToolName.ListWaitingAccounts });
    expect(structured).toMatchObject({
      total: 2,
      accounts: [
        { accountId: 'acct_first', maskedPhone: maskedPhoneOf({ waId: FIRST_PHONE }), locale: OwnerLocale.PortugueseBrazil },
        { accountId: 'acct_second', maskedPhone: maskedPhoneOf({ waId: SECOND_PHONE }) },
      ],
    });
    expect(text).not.toContain(FIRST_PHONE);
    expect(text).not.toContain(SECOND_PHONE);
    expect(text).not.toContain('acct_active');
  });

  test('filters by language and honours the limit', async () => {
    await seedTwoWaiting();
    const english = await call({ name: OperatorToolName.ListWaitingAccounts, arguments: { locale: OwnerLocale.EnglishUs } });
    expect(english.structured).toMatchObject({ total: 1, accounts: [{ accountId: 'acct_second' }] });
    const limited = await call({ name: OperatorToolName.ListWaitingAccounts, arguments: { limit: 1 } });
    expect(limited.structured).toMatchObject({ total: 2, accounts: [{ accountId: 'acct_first' }] });
  });
});

describe('release_access', () => {
  test.each([{}, { confirm: false }, { confirm: 'true' }])(
    'refuses without an explicit confirm: true (%j) and changes nothing',
    async (confirmation) => {
      await seedTwoWaiting();
      const outcome = await call({ name: OperatorToolName.ReleaseAccess, arguments: { accountIds: ['acct_first'], ...confirmation } });
      expect(outcome.isError).toBe(true);
      expect(await stateOfAccount({ accountId: 'acct_first' })).toBe(AccountState.Waitlisted);
      expect(await auditRows({ action: BackofficeAuditAction.AccessReleased })).toEqual([]);
    },
  );

  test('says confirm_required when the confirmation is missing', async () => {
    await seedTwoWaiting();
    const outcome = await call({ name: OperatorToolName.ReleaseAccess, arguments: { accountIds: ['acct_first'], confirm: false } });
    expect(outcome.text).toContain('confirm_required');
  });

  test('releases the accounts through the same use case, returns counts and audits them under the key', async () => {
    await seedTwoWaiting();
    const outcome = await call({
      name: OperatorToolName.ReleaseAccess,
      arguments: { accountIds: ['acct_first', 'acct_second'], confirm: true },
    });
    expect(outcome.isError).toBe(false);
    expect(outcome.structured).toMatchObject({
      counts: { selected: 2, released: 2, alreadyActive: 0, notReleasable: 0, queued: 2, failed: 0, itemFailed: 0 },
    });
    expect(await stateOfAccount({ accountId: 'acct_first' })).toBe(AccountState.Active);
    expect(await stateOfAccount({ accountId: 'acct_second' })).toBe(AccountState.Active);
    expect(await auditRows({ action: BackofficeAuditAction.AccessReleased })).toEqual([
      {
        outcome: BackofficeAuditOutcome.Succeeded,
        target_id: 'selected=2 released=2 alreadyActive=0 notReleasable=0 sent=0 queued=2 failed=0 itemFailed=0',
        actor_key_id: keyId,
        client_address: CLIENT_ADDRESS,
      },
    ]);
    expect(outcome.text).not.toContain(FIRST_PHONE);
  });

  test('releasing again is a no-op, an unknown id and a suspended account are not releasable, and duplicates count once', async () => {
    await seedTwoWaiting();
    await seedWaitingAccount({ accountId: 'acct_suspended', phone: '5511911110009', state: AccountState.Suspended, createdAt: NOW });
    await call({ name: OperatorToolName.ReleaseAccess, arguments: { accountIds: ['acct_first'], confirm: true } });
    const outcome = await call({
      name: OperatorToolName.ReleaseAccess,
      arguments: { accountIds: ['acct_first', 'acct_first', 'acct_missing', 'acct_suspended'], confirm: true },
    });
    expect(outcome.structured).toMatchObject({ counts: { selected: 3, released: 0, alreadyActive: 1, notReleasable: 2 } });
    expect(await stateOfAccount({ accountId: 'acct_suspended' })).toBe(AccountState.Suspended);
  });

  test(`takes at most ${ACCESS_BATCH_LIMIT} accounts, as the Access page does, and refuses more with nothing released or audited`, async () => {
    await seedTwoWaiting();
    const accountIds = ['acct_first', ...Array.from({ length: ACCESS_BATCH_LIMIT }, (_, index) => `acct_extra_${index}`)];
    const outcome = await call({ name: OperatorToolName.ReleaseAccess, arguments: { accountIds, confirm: true } });
    expect(outcome.isError).toBe(true);
    expect(outcome.text).toContain('batch_too_large');
    expect(await stateOfAccount({ accountId: 'acct_first' })).toBe(AccountState.Waitlisted);
    expect(await auditRows({ action: BackofficeAuditAction.AccessReleased })).toEqual([]);
  });

  test('accepts exactly the batch limit', async () => {
    const accountIds = Array.from({ length: ACCESS_BATCH_LIMIT }, (_, index) => `acct_${index}`);
    await Promise.all(
      accountIds.map((accountId, index) => seedWaitingAccount({ accountId, phone: `55119111100${10 + index}`, createdAt: NOW })),
    );
    const outcome = await call({ name: OperatorToolName.ReleaseAccess, arguments: { accountIds, confirm: true } });
    expect(outcome.structured).toMatchObject({ counts: { selected: ACCESS_BATCH_LIMIT, released: ACCESS_BATCH_LIMIT } });
  });

  test('refuses an empty list', async () => {
    const outcome = await call({ name: OperatorToolName.ReleaseAccess, arguments: { accountIds: [], confirm: true } });
    expect(outcome.isError).toBe(true);
    expect(await auditRows({ action: BackofficeAuditAction.AccessReleased })).toEqual([]);
  });
});

describe('invite_waitlist', () => {
  beforeEach(async () => {
    await seedWaitlistEntry({ email: 'first@example.com', locale: OwnerLocale.PortugueseBrazil, createdAt: NOW - 2 * DAY_MS });
    await seedWaitlistEntry({ email: 'second@example.com', createdAt: NOW - DAY_MS });
  });

  test.each([{}, { confirm: false }])('refuses without confirm: true (%j) and issues nothing', async (confirmation) => {
    const outcome = await call({ name: OperatorToolName.InviteWaitlist, arguments: { entryIds: ['first@example.com'], ...confirmation } });
    expect(outcome.isError).toBe(true);
    expect(outcome.text).toContain('confirm_required');
    const { results } = await testEnv.CONNECTIONS.prepare('SELECT code_digest FROM waitlist_invites').all();
    expect(results).toEqual([]);
    expect(await auditRows({ action: BackofficeAuditAction.WaitlistInvited })).toEqual([]);
  });

  test('issues invites through the same use case, returns the links once and audits the counts under the key', async () => {
    const outcome = await call({
      name: OperatorToolName.InviteWaitlist,
      arguments: { entryIds: ['first@example.com', 'second@example.com'], confirm: true },
    });
    expect(outcome.isError).toBe(false);
    const { invites, counts } = outcome.structured as { invites: { entryId: string; link: string }[]; counts: Record<string, number> };
    expect(counts).toMatchObject({ selected: 2, issued: 2, skipped: 0 });
    expect(invites.map((invite) => invite.entryId)).toEqual(['first@example.com', 'second@example.com']);
    invites.forEach((invite) => expect(invite.link).toMatch(/^https:\/\/wa\.me\/5511977770000\?text=.*zbi_[a-z2-7]{24}/));
    const { results } = await testEnv.CONNECTIONS.prepare('SELECT code_digest FROM waitlist_invites').all<{ code_digest: string }>();
    expect(results).toHaveLength(2);
    results.forEach((row) => expect(outcome.text).not.toContain(row.code_digest));
    expect(await auditRows({ action: BackofficeAuditAction.WaitlistInvited })).toEqual([
      {
        outcome: BackofficeAuditOutcome.Succeeded,
        target_id: 'selected=2 issued=2 skipped=0',
        actor_key_id: keyId,
        client_address: CLIENT_ADDRESS,
      },
    ]);
  });

  test('skips an entry that already holds a live invite and an unknown entry', async () => {
    await seedInvite({ email: 'first@example.com', digest: 'live', createdAt: NOW, expiresAt: NOW + DAY_MS });
    const outcome = await call({
      name: OperatorToolName.InviteWaitlist,
      arguments: { entryIds: ['first@example.com', 'second@example.com', 'ghost@example.com'], confirm: true },
    });
    expect(outcome.structured).toMatchObject({ counts: { selected: 3, issued: 1, skipped: 2 } });
  });

  test(`takes at most ${ACCESS_BATCH_LIMIT} entries`, async () => {
    const entryIds = Array.from({ length: ACCESS_BATCH_LIMIT + 1 }, (_, index) => `person${index}@example.com`);
    const outcome = await call({ name: OperatorToolName.InviteWaitlist, arguments: { entryIds, confirm: true } });
    expect(outcome.isError).toBe(true);
    expect(outcome.text).toContain('batch_too_large');
    expect(await auditRows({ action: BackofficeAuditAction.WaitlistInvited })).toEqual([]);
  });

  test('refuses when no number is active to build the link, and audits nothing', async () => {
    await testEnv.CONNECTIONS.prepare('DELETE FROM whatsapp_numbers').run();
    const outcome = await call({ name: OperatorToolName.InviteWaitlist, arguments: { entryIds: ['first@example.com'], confirm: true } });
    expect(outcome.isError).toBe(true);
    expect(outcome.text).toContain('no_start_number');
    expect(await auditRows({ action: BackofficeAuditAction.WaitlistInvited })).toEqual([]);
  });
});

describe('list_audit', () => {
  test('lists the newest rows first with the actor key, and never a client address', async () => {
    await call({ name: OperatorToolName.ReleaseAccess, arguments: { accountIds: ['acct_missing'], confirm: true } });
    const { structured, text } = await call({ name: OperatorToolName.ListAudit });
    const [newest] = (structured as { rows: unknown[] }).rows;
    expect(newest).toMatchObject({
      action: BackofficeAuditAction.AccessReleased,
      actorKeyId: keyId,
      outcome: BackofficeAuditOutcome.Succeeded,
    });
    expect(text).not.toContain(CLIENT_ADDRESS);
  });

  test('honours the limit and refuses a limit above the cap', async () => {
    await Promise.all(
      [1, 2, 3].map((index) =>
        testEnv.CONNECTIONS.prepare(
          'INSERT INTO backoffice_audit (id, at, action, target_kind, target_id, outcome, client_address) VALUES (?, ?, ?, NULL, NULL, ?, NULL)',
        )
          .bind(`row_${index}`, NOW + index, BackofficeAuditAction.SignOut, BackofficeAuditOutcome.Succeeded)
          .run(),
      ),
    );
    const limited = await call({ name: OperatorToolName.ListAudit, arguments: { limit: 2 } });
    expect((limited.structured as { rows: unknown[] }).rows).toHaveLength(2);
    expect((await call({ name: OperatorToolName.ListAudit, arguments: { limit: OPERATOR_MCP_AUDIT_LIMIT + 1 } })).isError).toBe(true);
  });
});

describe('hardening', () => {
  test('counts bad keys against the client address, apart from the key limit', async () => {
    const limiter = createFakeRateLimiter({ limit: 2 });
    const env = backofficeEnv({ overrides: { OPERATOR_KEY_RATE_LIMITER: limiter } });
    const attempt = () => requestOperatorMcp({ bearer: `${key}x`, env, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    const statuses = [(await attempt()).status, (await attempt()).status, (await attempt()).status];
    expect(statuses).toEqual([HttpStatus.Unauthorized, HttpStatus.Unauthorized, HttpStatus.TooManyRequests]);
    expect(new Set(limiter.calls)).toEqual(new Set([`ip:${CLIENT_ADDRESS}`]));
    const valid = await requestOperatorMcp({ bearer: key, env, body: { jsonrpc: '2.0', id: 1, method: 'tools/list' } });
    expect(valid.status).toBe(HttpStatus.Ok);
  });

  test('reads no session, even when a session cookie comes along', async () => {
    const { env, prepared } = recordingEnvironment();
    const response = await requestOperatorMcp({
      bearer: key,
      env,
      headers: { Cookie: `${SESSION_COOKIE}=forged-session-token` },
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });
    expect(response.status).toBe(HttpStatus.Ok);
    expect(prepared.filter((sql) => sql.includes('backoffice_sessions'))).toEqual([]);
  });

  test.each([
    [OperatorToolName.ReleaseAccess, 'accountIds'],
    [OperatorToolName.InviteWaitlist, 'entryIds'],
  ])('bounds the %s id list and each id length', async (name, field) => {
    const tooMany = Array.from({ length: OPERATOR_MCP_MAX_IDS + 1 }, (_, index) => `id${index}`);
    const tooLong = ['x'.repeat(OPERATOR_MCP_ID_MAX_LENGTH + 1)];
    expect((await call({ name, arguments: { [field]: tooMany, confirm: true } })).isError).toBe(true);
    expect((await call({ name, arguments: { [field]: tooLong, confirm: true } })).isError).toBe(true);
    expect(await auditRows({ action: BackofficeAuditAction.AccessReleased })).toEqual([]);
    expect(await auditRows({ action: BackofficeAuditAction.WaitlistInvited })).toEqual([]);
  });

  test('a batch that throws writes one failed audit row under the key', async () => {
    await seedWaitlistEntry({ email: 'first@example.com', createdAt: NOW - DAY_MS });
    const database = new Proxy(testEnv.CONNECTIONS, {
      get(target, property) {
        if (property === 'batch') return () => Promise.reject(new Error('the database is down'));
        const member = Reflect.get(target, property);
        return typeof member === 'function' ? member.bind(target) : member;
      },
    });
    const env = backofficeEnv({ overrides: { CONNECTIONS: database } });
    const outcome = await callOperatorTool({
      bearer: key,
      env,
      name: OperatorToolName.InviteWaitlist,
      arguments: { entryIds: ['first@example.com'], confirm: true },
    });
    expect(outcome.isError).toBe(true);
    expect(await auditRows({ action: BackofficeAuditAction.WaitlistInvited })).toEqual([
      { outcome: BackofficeAuditOutcome.Failed, target_id: 'selected=1 itemFailed=1', actor_key_id: keyId, client_address: CLIENT_ADDRESS },
    ]);
  });
});
