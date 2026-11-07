import { DAY_MS } from '@zapbip/types';
import { beforeEach, describe, expect, test } from 'vitest';
import { writeAudit } from '../../src/backoffice/audit/audit-log';
import { BackofficeAuditAction, BackofficeAuditOutcome } from '../../src/backoffice/audit/backoffice-audit-action';
import { csrfTokenOf } from '../../src/backoffice/auth/csrf';
import { BACKOFFICE_AUDIT_RETENTION_MS, BACKOFFICE_SESSION_MAX_MS } from '../../src/contract/constants';
import { SCHEDULED_CRON } from '../../src/operations/constants';
import { runScheduled, SCHEDULED_JOBS, ScheduledJobName } from '../../src/operations/scheduled';
import { testEnv } from '../support/workers-env';
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_TEST_KEY,
  CLIENT_ADDRESS,
  postSignIn,
  requestBackoffice,
  resetBackoffice,
  SESSION_COOKIE,
  signIn,
  validCode,
  WRONG_CODE,
  WRONG_KEY,
} from './backoffice-auth-fixtures';

const NOW = Date.UTC(2026, 10, 7, 4, 0);
const PRUNE_JOBS = { prune: SCHEDULED_JOBS[ScheduledJobName.BackofficePrune] };

beforeEach(resetBackoffice);

type AuditRow = { action: string; target_kind: string | null; target_id: string | null; outcome: string; client_address: string | null };

async function auditRows(): Promise<AuditRow[]> {
  const { results } = await testEnv.CONNECTIONS.prepare(
    'SELECT action, target_kind, target_id, outcome, client_address FROM backoffice_audit',
  ).all<AuditRow>();
  return results;
}

async function count(input: { table: string }): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare(`SELECT COUNT(*) AS total FROM ${input.table}`).first<{ total: number }>();
  return row!.total;
}

describe('audit log', () => {
  test('a successful sign-in, a failed one and a sign-out each write one row', async () => {
    await postSignIn({ key: WRONG_KEY, code: WRONG_CODE });
    const { sessionToken } = await signIn({});
    await requestBackoffice({
      path: '/sign-out',
      method: 'POST',
      form: { csrf: await csrfTokenOf({ sessionToken }) },
      cookies: { [SESSION_COOKIE]: sessionToken },
      headers: { Origin: BACKOFFICE_ORIGIN },
    });
    expect((await auditRows()).map((row) => row.action).sort()).toEqual(['sign_in.failed', 'sign_in.succeeded', 'sign_out']);
  });

  test('every action in the enum can be written as exactly one row', async () => {
    await Promise.all(
      Object.values(BackofficeAuditAction).map((action) =>
        writeAudit({
          database: testEnv.CONNECTIONS,
          entry: {
            now: NOW,
            action,
            outcome: BackofficeAuditOutcome.Succeeded,
            targetKind: null,
            targetId: null,
            clientAddress: CLIENT_ADDRESS,
          },
        }),
      ),
    );
    expect((await auditRows()).map((row) => row.action).sort()).toEqual(Object.values(BackofficeAuditAction).sort());
  });

  test('no column holds the key, a code or the session token', async () => {
    await postSignIn({ key: WRONG_KEY, code: WRONG_CODE });
    const code = await validCode({});
    const { sessionToken } = await signIn({});
    const serialised = JSON.stringify(await auditRows());
    [BACKOFFICE_TEST_KEY, WRONG_KEY, WRONG_CODE, code, sessionToken].forEach((secret) => expect(serialised).not.toContain(secret));
  });
});

describe('scheduled prune', () => {
  test('deletes expired sessions and audit rows older than the retention, keeps the rest', async () => {
    const database = testEnv.CONNECTIONS;
    await database.batch([
      database
        .prepare('INSERT INTO backoffice_sessions (token_digest, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?)')
        .bind('expired', NOW - DAY_MS, NOW - DAY_MS, NOW - 1),
      database
        .prepare('INSERT INTO backoffice_sessions (token_digest, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?)')
        .bind('alive', NOW, NOW, NOW + BACKOFFICE_SESSION_MAX_MS),
    ]);
    await Promise.all(
      [NOW - BACKOFFICE_AUDIT_RETENTION_MS - DAY_MS, NOW - BACKOFFICE_AUDIT_RETENTION_MS + DAY_MS].map((at) =>
        writeAudit({
          database,
          entry: {
            now: at,
            action: BackofficeAuditAction.SignOut,
            outcome: BackofficeAuditOutcome.Succeeded,
            targetKind: null,
            targetId: null,
            clientAddress: null,
          },
        }),
      ),
    );
    await runScheduled({ cron: SCHEDULED_CRON, now: NOW, env: testEnv, jobs: PRUNE_JOBS });
    expect(await count({ table: 'backoffice_sessions' })).toBe(1);
    expect(await count({ table: 'backoffice_audit' })).toBe(1);
  });
});
