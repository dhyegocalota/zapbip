import { reset } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { pruneClientApp } from '../../src/client-app/prune';
import { ScheduledJobName, SCHEDULED_JOBS } from '../../src/operations/scheduled';
import { ACCOUNT, issueSignInToken, prepareClientAppDatabase, seedAccountForApp } from '../support/client-app';
import { testEnv } from '../support/workers-env';

const NOW = 1_800_000_000_000;
const INSERT_SESSION_STATEMENT = 'INSERT INTO client_app_sessions (session_digest, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)';
const TOKEN_COUNT_STATEMENT = 'SELECT COUNT(*) AS total FROM client_app_sign_in_tokens';
const SESSION_DIGESTS_STATEMENT = 'SELECT session_digest AS digest FROM client_app_sessions';

async function total(): Promise<number> {
  return (await testEnv.CONNECTIONS.prepare(TOKEN_COUNT_STATEMENT).first<{ total: number }>())!.total;
}

function insertSession(input: { digest: string; expiresAt: number }) {
  return testEnv.CONNECTIONS.prepare(INSERT_SESSION_STATEMENT).bind(input.digest, ACCOUNT, NOW, input.expiresAt).run();
}

beforeEach(async () => {
  await prepareClientAppDatabase();
  await seedAccountForApp({});
});
afterEach(reset);

describe('pruneClientApp', () => {
  it('removes expired tokens and sessions and keeps the live ones', async () => {
    await issueSignInToken({ expiresAt: NOW - 1 });
    await insertSession({ digest: 'expired', expiresAt: NOW - 1 });
    await insertSession({ digest: 'live', expiresAt: NOW + 1 });
    await pruneClientApp({ database: testEnv.CONNECTIONS, now: NOW });
    expect(await total()).toBe(0);
    const sessions = await testEnv.CONNECTIONS.prepare(SESSION_DIGESTS_STATEMENT).all<{ digest: string }>();
    expect(sessions.results.map((row) => row.digest)).toEqual(['live']);
  });

  it('keeps a live token', async () => {
    await issueSignInToken({ expiresAt: NOW + 1 });
    await pruneClientApp({ database: testEnv.CONNECTIONS, now: NOW });
    expect(await total()).toBe(1);
  });

  it('is a scheduled job due on every tick', async () => {
    const job = SCHEDULED_JOBS[ScheduledJobName.ClientAppPrune];
    await issueSignInToken({ expiresAt: 1 });
    expect(job.isDue({ now: NOW })).toBe(true);
    await job.run({ env: testEnv, now: NOW });
    expect(await total()).toBe(0);
  });
});
