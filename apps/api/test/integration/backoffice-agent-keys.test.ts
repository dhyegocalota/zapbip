import { DAY_MS, HttpStatus, OwnerLocale } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  BackofficeAuditAction,
  BackofficeAuditOutcome,
  BackofficeAuditTargetKind,
} from '../../src/backoffice/audit/backoffice-audit-action';
import { csrfTokenOf } from '../../src/backoffice/auth/csrf';
import { BACKOFFICE_COPY, BackofficeCopyKey } from '../../src/backoffice/backoffice-copy';
import { LABEL_MAX_LENGTH } from '../../src/backoffice/backoffice-constants';
import { TOTP_PERIOD_MS } from '../../src/contract/constants';
import { hashOperatorKey } from '../../src/backoffice/operator-mcp/operator-key';
import {
  OPERATOR_KEY_DEFAULT_LIFETIME_MS,
  OPERATOR_KEY_MAX_LIFETIME_DAYS,
  OPERATOR_KEY_PATTERN,
} from '../../src/backoffice/operator-mcp/operator-mcp-constants';
import { captureLogLines } from '../support/capture-log-lines';
import { operatorKeyRows, seedOperatorKey } from '../support/operator-keys';
import { escapedHtml } from '../support/site';
import { testEnv } from '../support/workers-env';
import { BACKOFFICE_ORIGIN, requestBackoffice, SESSION_COOKIE } from './backoffice-auth-fixtures';
import {
  endBackofficeSession,
  getPage,
  NOW,
  postAction,
  postForm,
  startBackofficeSession,
  submitRejectedAction,
} from './backoffice-numbers-fixtures';

const STATUS_SEE_OTHER = 303;
const PAGE_PATH = '/agent-keys';
const REVOKE_PATH = '/agent-keys/revoke';
const KEY_IN_PAGE = /zbo_[0-9a-f]{16}_[A-Za-z0-9_-]{43}/;
const copy = BACKOFFICE_COPY[OwnerLocale.PortugueseBrazil];

let sessionToken: string;

function copyHtml(input: { key: BackofficeCopyKey; values?: Record<string, string> }): string {
  const { key, values = {} } = input;
  return escapedHtml({ text: Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), copy[key]) });
}

async function auditRows(input: { action: BackofficeAuditAction }): Promise<{ outcome: string; target_kind: string; target_id: string }[]> {
  const { results } = await testEnv.CONNECTIONS.prepare(
    'SELECT outcome, target_kind, target_id FROM backoffice_audit WHERE action = ? ORDER BY at, rowid',
  )
    .bind(input.action)
    .all<{ outcome: string; target_kind: string; target_id: string }>();
  return results;
}

async function createKey(input: { label: string; lifetimeDays?: string; code?: string }): Promise<Response> {
  const lifetime: Record<string, string> = input.lifetimeDays === undefined ? {} : { lifetimeDays: input.lifetimeDays };
  return postAction({ path: PAGE_PATH, sessionToken, fields: { label: input.label, ...lifetime }, code: input.code });
}

beforeEach(async () => {
  await testEnv.CONNECTIONS.prepare('DELETE FROM backoffice_agent_keys').run();
  sessionToken = await startBackofficeSession();
});

afterEach(() => {
  endBackofficeSession();
  vi.restoreAllMocks();
});

describe('the agent keys page', () => {
  test('redirects the page to sign-in and refuses both forms without a session', async () => {
    const page = await requestBackoffice({ path: PAGE_PATH });
    expect(page.status).toBe(STATUS_SEE_OTHER);
    expect(page.headers.get('Location')).toBe('/sign-in');
    const create = await requestBackoffice({ path: PAGE_PATH, method: 'POST', form: { label: 'x' } });
    const revoke = await requestBackoffice({ path: REVOKE_PATH, method: 'POST', form: { keyId: 'x' } });
    expect([create.status, revoke.status]).toEqual([HttpStatus.Unauthorized, HttpStatus.Unauthorized]);
  });

  test('shows the empty state, the navigation link and the human-only note', async () => {
    const html = await (await getPage({ path: PAGE_PATH, sessionToken })).text();
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AgentKeysEmpty }));
    expect(html).toContain(`href="${PAGE_PATH}"`);
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.NavigationAgentKeys }));
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AgentKeysIntro }));
  });

  test('lists label, created, last used and expiry with the status of each key', async () => {
    await seedOperatorKey({ label: 'live agent', createdAt: NOW, expiresAt: NOW + DAY_MS, lastUsedAt: NOW - 1000 });
    await seedOperatorKey({ label: 'old agent', createdAt: NOW - 2 * DAY_MS, expiresAt: NOW - DAY_MS });
    await seedOperatorKey({ label: 'gone agent', createdAt: NOW, expiresAt: NOW + DAY_MS, revokedAt: NOW - 5 });
    const html = await (await getPage({ path: PAGE_PATH, sessionToken })).text();
    expect(html).toContain('live agent');
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AgentKeysStatusActive }));
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AgentKeysStatusExpired }));
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AgentKeysStatusRevoked }));
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AgentKeysNeverUsed }));
    expect(html).not.toMatch(KEY_IN_PAGE);
  });

  test('offers a revoke button only for a live key', async () => {
    const live = await seedOperatorKey({ label: 'live agent', createdAt: NOW, expiresAt: NOW + DAY_MS });
    const gone = await seedOperatorKey({ label: 'gone agent', createdAt: NOW, expiresAt: NOW + DAY_MS, revokedAt: NOW - 5 });
    const html = await (await getPage({ path: PAGE_PATH, sessionToken })).text();
    expect(html).toContain(`value="${live.keyId}"`);
    expect(html).not.toContain(`value="${gone.keyId}"`);
  });
});

describe('creating a key', () => {
  test('shows the key once, stores only its digest, defaults the expiry and audits the creation', async () => {
    const response = await createKey({ label: 'nightly agent' });
    expect(response.status).toBe(HttpStatus.Ok);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const html = await response.text();
    const key = KEY_IN_PAGE.exec(html)?.[0];
    if (key === undefined) throw new Error('the result page shows no key');
    expect(key).toMatch(OPERATOR_KEY_PATTERN);
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AgentKeysCreatedHelp }));
    expect(html).toContain(`${BACKOFFICE_ORIGIN}/mcp`);
    const [row, ...others] = await operatorKeyRows();
    expect(others).toEqual([]);
    expect(row).toMatchObject({
      label: 'nightly agent',
      created_at: NOW + TOTP_PERIOD_MS,
      expires_at: NOW + TOTP_PERIOD_MS + OPERATOR_KEY_DEFAULT_LIFETIME_MS,
      last_used_at: null,
      revoked_at: null,
    });
    expect(row?.key_digest).toBe(await hashOperatorKey({ key }));
    expect(JSON.stringify(row)).not.toContain(key);
    expect(await auditRows({ action: BackofficeAuditAction.AgentKeyCreated })).toEqual([
      { outcome: BackofficeAuditOutcome.Succeeded, target_kind: BackofficeAuditTargetKind.AgentKey, target_id: row?.id },
    ]);
  });

  test('never shows the key again on the page or in the audit log', async () => {
    const html = await (await createKey({ label: 'nightly agent' })).text();
    const key = KEY_IN_PAGE.exec(html)?.[0];
    if (key === undefined) throw new Error('the result page shows no key');
    const listing = await (await getPage({ path: PAGE_PATH, sessionToken })).text();
    expect(listing).not.toContain(key);
    expect(listing).toContain('nightly agent');
    const { results } = await testEnv.CONNECTIONS.prepare('SELECT * FROM backoffice_audit').all();
    expect(JSON.stringify(results)).not.toContain(key);
  });

  test('takes an explicit lifetime in days', async () => {
    await createKey({ label: 'short', lifetimeDays: '7' });
    const [row] = await operatorKeyRows();
    if (row === undefined) throw new Error('no key was created');
    expect(row.expires_at).toBe(row.created_at + 7 * DAY_MS);
  });

  test.each(['0', '-1', '1.5', 'abc', String(OPERATOR_KEY_MAX_LIFETIME_DAYS + 1)])(
    'refuses the lifetime %j with a 422 page and no key',
    async (lifetimeDays) => {
      const { posted, followed } = await submitRejectedAction({
        path: PAGE_PATH,
        sessionToken,
        fields: { label: 'bad lifetime', lifetimeDays },
      });
      expect(posted.status).toBe(STATUS_SEE_OTHER);
      expect(followed.status).toBe(HttpStatus.UnprocessableEntity);
      expect(await operatorKeyRows()).toEqual([]);
    },
  );

  test.each(['', '   ', 'x'.repeat(LABEL_MAX_LENGTH + 1)])('refuses the label %j with a 422 page and no key', async (label) => {
    const { followed } = await submitRejectedAction({ path: PAGE_PATH, sessionToken, fields: { label } });
    expect(followed.status).toBe(HttpStatus.UnprocessableEntity);
    expect(await followed.text()).toContain(
      copyHtml({
        key: BackofficeCopyKey.AgentKeysInvalid,
        values: { max: String(LABEL_MAX_LENGTH), days: String(OPERATOR_KEY_MAX_LIFETIME_DAYS) },
      }),
    );
    expect(await operatorKeyRows()).toEqual([]);
  });

  test('refuses a wrong step-up code with a 401 page and no key', async () => {
    const { posted, followed } = await submitRejectedAction({ path: PAGE_PATH, sessionToken, fields: { label: 'agent' }, code: '000000' });
    expect(posted.status).toBe(STATUS_SEE_OTHER);
    expect(followed.status).toBe(HttpStatus.Unauthorized);
    expect(await operatorKeyRows()).toEqual([]);
    expect(await auditRows({ action: BackofficeAuditAction.AgentKeyCreated })).toEqual([]);
  });

  test('refuses a missing code', async () => {
    const response = await postForm({ path: PAGE_PATH, sessionToken, fields: { label: 'agent' } });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(await operatorKeyRows()).toEqual([]);
  });

  test('refuses a bad csrf token and a foreign origin', async () => {
    const badToken = await postAction({ path: PAGE_PATH, sessionToken, fields: { label: 'agent' }, origin: 'https://evil.example' });
    const wrongCsrf = await requestBackoffice({
      path: PAGE_PATH,
      method: 'POST',
      form: { label: 'agent', csrf: `${await csrfTokenOf({ sessionToken })}x`, code: '123456' },
      cookies: { [SESSION_COOKIE]: sessionToken },
      headers: { Origin: BACKOFFICE_ORIGIN },
    });
    expect([badToken.status, wrongCsrf.status]).toEqual([HttpStatus.Forbidden, HttpStatus.Forbidden]);
    expect(await operatorKeyRows()).toEqual([]);
  });

  test('logs neither the key nor its digest', async () => {
    const lines = captureLogLines();
    const html = await (await createKey({ label: 'quiet agent' })).text();
    const key = KEY_IN_PAGE.exec(html)?.[0];
    if (key === undefined) throw new Error('the result page shows no key');
    const [row] = await operatorKeyRows();
    if (row === undefined) throw new Error('no key was created');
    expect(lines.join('\n')).not.toContain(key);
    expect(lines.join('\n')).not.toContain(row.key_digest);
  });
});

describe('revoking a key', () => {
  test('revokes a live key, redirects with a notice and audits it', async () => {
    const { keyId } = await seedOperatorKey({ label: 'doomed', createdAt: NOW, expiresAt: NOW + DAY_MS });
    const response = await postForm({ path: REVOKE_PATH, sessionToken, fields: { keyId } });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('Location')).toBe(`${PAGE_PATH}?notice=AgentKeyRevoked`);
    const [row] = await operatorKeyRows();
    expect(row?.revoked_at).toBe(NOW);
    expect(await auditRows({ action: BackofficeAuditAction.AgentKeyRevoked })).toEqual([
      { outcome: BackofficeAuditOutcome.Succeeded, target_kind: BackofficeAuditTargetKind.AgentKey, target_id: keyId },
    ]);
    const html = await (await getPage({ path: response.headers.get('Location') as string, sessionToken })).text();
    expect(html).toContain(copyHtml({ key: BackofficeCopyKey.AgentKeyRevokedNotice }));
  });

  test('answers 404 for an unknown key and for one already revoked, and audits nothing', async () => {
    const { keyId } = await seedOperatorKey({ label: 'gone', createdAt: NOW, expiresAt: NOW + DAY_MS, revokedAt: NOW - 5 });
    const unknown = await postForm({ path: REVOKE_PATH, sessionToken, fields: { keyId: '0000000000000000' } });
    const repeated = await postForm({ path: REVOKE_PATH, sessionToken, fields: { keyId } });
    expect([unknown.status, repeated.status]).toEqual([HttpStatus.NotFound, HttpStatus.NotFound]);
    expect(await auditRows({ action: BackofficeAuditAction.AgentKeyRevoked })).toEqual([]);
    expect((await operatorKeyRows())[0]?.revoked_at).toBe(NOW - 5);
  });

  test('refuses a revoke without the csrf token', async () => {
    const { keyId } = await seedOperatorKey({ label: 'safe', createdAt: NOW, expiresAt: NOW + DAY_MS });
    const response = await requestBackoffice({
      path: REVOKE_PATH,
      method: 'POST',
      form: { keyId },
      cookies: { [SESSION_COOKIE]: sessionToken },
      headers: { Origin: BACKOFFICE_ORIGIN },
    });
    expect(response.status).toBe(HttpStatus.Forbidden);
    expect((await operatorKeyRows())[0]?.revoked_at).toBeNull();
  });
});
