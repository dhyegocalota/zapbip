import { AccountState, WakeMode } from '@zapbip/types';
import { reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyDirectoryMigration, seedConnection } from '../support/seed';
import { accountInboxStub, connectionOf, testEnv } from '../support/workers-env';

const ACCOUNT = 'acc_admission';
const AGENT = 'alpha';
const SECRET = `zb_conn_${'K'.repeat(43)}`;
const NEW_SECRET = `zb_conn_${'L'.repeat(43)}`;
const REVOKED_AT = 1;
const UNSEEDED_ACCOUNT = 'acc_unseeded';
const WAKE_URL = 'https://api2.cursor.sh/automations/webhook/abc12345';
const WAKE_TOKEN = 'grok-token-sixteen-chars';

function stubOf() {
  return accountInboxStub({ accountId: ACCOUNT });
}

function sendFromAgent() {
  return stubOf().sendText({ connection: connectionOf({ accountId: ACCOUNT, agent: AGENT }), text: 'oi', replyToMessageId: null });
}

function createUploadFromAgent() {
  return stubOf().createUpload({
    connection: connectionOf({ accountId: ACCOUNT, agent: AGENT }),
    filename: 'a.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 3,
  });
}

async function setState(input: { state: AccountState }): Promise<void> {
  await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(input.state, ACCOUNT).run();
}

async function revokeAgent(): Promise<void> {
  await testEnv.CONNECTIONS.prepare('UPDATE connections SET revoked_at = ? WHERE account_id = ? AND agent = ?')
    .bind(REVOKED_AT, ACCOUNT, AGENT)
    .run();
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedConnection({ accountId: ACCOUNT, agent: AGENT, secret: SECRET });
});
afterEach(reset);

describe('Durable Object agent admission', () => {
  it('serves an active connection', async () => {
    expect((await sendFromAgent()).ok).toBe(true);
  });

  it('refuses a revoked connection on the next call', async () => {
    await sendFromAgent();
    await revokeAgent();
    expect((await sendFromAgent()).ok).toBe(false);
  });

  it('setWake refuses a revoked agent and writes no wake row', async () => {
    await revokeAgent();
    const outcome = await stubOf().setWake({
      connection: connectionOf({ accountId: ACCOUNT, agent: AGENT }),
      setting: { mode: WakeMode.Webhook, url: WAKE_URL, token: WAKE_TOKEN },
    });
    expect(outcome.ok).toBe(false);
    const wakeRows = await runInDurableObject(stubOf(), (_instance, state) =>
      state.storage.sql.exec('SELECT agent FROM agent_wake').toArray(),
    );
    expect(wakeRows).toEqual([]);
  });

  it('refuses every call of an account that has no row in the directory', async () => {
    const stub = accountInboxStub({ accountId: UNSEEDED_ACCOUNT });
    const outcome = await stub.sendText({
      connection: connectionOf({ accountId: UNSEEDED_ACCOUNT, agent: AGENT }),
      text: 'oi',
      replyToMessageId: null,
    });
    expect(outcome.ok).toBe(false);
  });

  it('createUpload serves an active connection', async () => {
    expect((await createUploadFromAgent()).ok).toBe(true);
  });

  it('[row 488] createUpload refuses a revoked agent', async () => {
    await revokeAgent();
    expect((await createUploadFromAgent()).ok).toBe(false);
  });

  it.each([AccountState.Suspended, AccountState.Deleting, AccountState.Waitlisted])(
    '[row 488] createUpload refuses a %s account',
    async (state) => {
      await setState({ state });
      expect((await createUploadFromAgent()).ok).toBe(false);
    },
  );

  it('serves a name that was revoked and created again', async () => {
    await revokeAgent();
    await seedConnection({ accountId: ACCOUNT, agent: AGENT, secret: NEW_SECRET });
    expect((await sendFromAgent()).ok).toBe(true);
  });

  it.each([AccountState.Suspended, AccountState.Deleting, AccountState.Waitlisted])(
    'refuses every call while the account is %s',
    async (state) => {
      await setState({ state });
      expect((await sendFromAgent()).ok).toBe(false);
      const read = await stubOf().checkInbox({ connection: connectionOf({ accountId: ACCOUNT, agent: AGENT }) });
      expect(read.ok).toBe(false);
    },
  );

  it('ends a waiter of the agent when its next call is refused', async () => {
    const connection = connectionOf({ accountId: ACCOUNT, agent: AGENT });
    const held = stubOf().waitForReply({ connection, questionId: null, timeoutMs: 20_000 });
    await revokeAgent();
    await sendFromAgent();
    const settled = await Promise.race([held.then(() => 'settled'), new Promise((resolve) => setTimeout(() => resolve('hung'), 3_000))]);
    expect(settled).toBe('settled');
  });

  it('[row 480] stops the alarm of an account that is no longer active', async () => {
    const connection = connectionOf({ accountId: ACCOUNT, agent: AGENT });
    await stubOf().ask({ connection, text: 'Deploy?', options: ['Sim', 'Nao'], optionDescriptions: [null, null], timeoutMs: 10 });
    expect(await runInDurableObject(stubOf(), (_instance, state) => state.storage.getAlarm())).not.toBeNull();
    await setState({ state: AccountState.Suspended });
    await runDurableObjectAlarm(stubOf());
    expect(await runInDurableObject(stubOf(), (_instance, state) => state.storage.getAlarm())).toBeNull();
  });
});
