import type { AgentName } from '@zapbip/core';
import { HttpStatus, InboxErrorCode, InboxStatus, WakeMode } from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import { receiveOwnerText } from '../support/inbox-session';
import { applyDirectoryMigration, seedConnection } from '../support/seed';
import { ACCEPTED, WAKE_ACCOUNT, enablePinnedWake, expectOk, wakeStub } from '../support/wake-session';
import { connectionOf, testEnv } from '../support/workers-env';

const ACCOUNT = WAKE_ACCOUNT;
const PRIMARY: AgentName = 'agent-ten';
const STANDBY: AgentName = 'agent-eight';
const SECRET = `zb_conn_${'R'.repeat(43)}`;
const OWNER_TEXT = 'oi';
const REVOKED_AT = 1;
const CONNECTOR_URL = 'http://account-inbox/connector';
const UPGRADE_HEADERS = { Upgrade: 'websocket' };

let stub: DurableObjectStub<DevAccountInbox>;
let standbyDigest: string;

function connectionFor(input: { agent: AgentName }) {
  return connectionOf({ accountId: ACCOUNT, agent: input.agent });
}

function rowCounts(input: { agent: AgentName }): Promise<{ agents: number; wakes: number }> {
  return runInDurableObject(stub, (_instance, state) => ({
    agents: state.storage.sql.exec<{ total: number }>('SELECT COUNT(*) AS total FROM agents WHERE agent = ?', input.agent).one().total,
    wakes: state.storage.sql.exec<{ total: number }>('SELECT COUNT(*) AS total FROM agent_wake WHERE agent = ?', input.agent).one().total,
  }));
}

function copyCount(input: { agent: AgentName }): Promise<number> {
  return runInDurableObject(
    stub,
    (_instance, state) =>
      state.storage.sql
        .exec<{ total: number }>(
          'SELECT COUNT(*) AS total FROM inbox_messages WHERE agent = ? AND origin_message_id IS NOT NULL',
          input.agent,
        )
        .one().total,
  );
}

function setStandby(input: { agent: AgentName; standbyAgent: AgentName }) {
  return stub.setWake({
    connection: connectionFor({ agent: input.agent }),
    setting: { mode: WakeMode.Standby, url: null, token: null, intervalMinutes: null, standbyAgent: input.standbyAgent },
  });
}

function revokeInDirectory(): Promise<unknown> {
  return testEnv.CONNECTIONS.prepare('UPDATE connections SET revoked_at = ? WHERE account_id = ? AND agent = ?')
    .bind(REVOKED_AT, ACCOUNT, STANDBY)
    .run();
}

function injectGhostWake(input: { agent: AgentName }): Promise<void> {
  return runInDurableObject(stub, (_instance, state) => {
    state.storage.sql.exec(
      'INSERT INTO agent_wake (agent, mode, last_polled_at, updated_at) VALUES (?, ?, 0, 0)',
      input.agent,
      WakeMode.None,
    );
  });
}

beforeEach(async () => {
  await applyDirectoryMigration();
  standbyDigest = await seedConnection({ accountId: ACCOUNT, agent: STANDBY, secret: SECRET });
  stub = wakeStub({ accountId: ACCOUNT });
});

afterEach(reset);

describe('a revoked agent is not resurrected by an in-flight call', () => {
  it('leaves no agent row and no wake row when a call that was admitted lands after the revocation', async () => {
    await stub.recordRevocation({ agent: STANDBY });
    expect(await stub.sendText({ connection: connectionFor({ agent: STANDBY }), text: OWNER_TEXT, replyToMessageId: null })).toMatchObject({
      ok: false,
      errorCode: InboxErrorCode.NotFound,
    });
    expect(await rowCounts({ agent: STANDBY })).toEqual({ agents: 0, wakes: 0 });
  });

  it('leaves no row when a check_inbox that was admitted lands after the revocation', async () => {
    await stub.recordRevocation({ agent: STANDBY });
    expect(await stub.checkInbox({ connection: connectionFor({ agent: STANDBY }) })).toMatchObject({
      ok: false,
      errorCode: InboxErrorCode.NotFound,
    });
    expect(await rowCounts({ agent: STANDBY })).toEqual({ agents: 0, wakes: 0 });
  });

  it('closes a connector upgrade of a revoked connection with the revoked code and leaves no row', async () => {
    await revokeInDirectory();
    const response = await stub.fetch(`${CONNECTOR_URL}?agent=${STANDBY}&digest=${standbyDigest}`, { headers: UPGRADE_HEADERS });
    expect(response.status).toBe(HttpStatus.SwitchingProtocols);
    expect(await rowCounts({ agent: STANDBY })).toEqual({ agents: 0, wakes: 0 });
  });

  it('does not accept a revoked name as a standby even when a stale wake row is still there', async () => {
    await stub.recordRevocation({ agent: STANDBY });
    await injectGhostWake({ agent: STANDBY });
    const outcome = await setStandby({ agent: PRIMARY, standbyAgent: STANDBY });
    expect(outcome.ok).toBe(false);
  });

  it('makes no copy for a revoked standby that still has a stale wake row', async () => {
    await enablePinnedWake({ stub, agent: STANDBY });
    expectOk(await setStandby({ agent: PRIMARY, standbyAgent: STANDBY }));
    await stub.recordRevocation({ agent: STANDBY });
    await injectGhostWake({ agent: STANDBY });
    await runInDurableObject(stub, (_instance, state) => {
      state.storage.sql.exec('UPDATE agent_wake SET mode = ?, standby_agent = ? WHERE agent = ?', WakeMode.Standby, STANDBY, PRIMARY);
    });
    expectOk(await receiveOwnerText({ stub, text: `@${PRIMARY} ${OWNER_TEXT}` }));
    expect(await copyCount({ agent: STANDBY })).toBe(0);
  });
});

describe('revoking a standby releases what the primary handed off', () => {
  beforeEach(async () => {
    await enablePinnedWake({ stub, agent: STANDBY });
    await stub.devScriptWake({ agent: STANDBY, responses: [ACCEPTED] });
    expectOk(await setStandby({ agent: PRIMARY, standbyAgent: STANDBY }));
  });

  it('returns the primary to mode none with no standby name', async () => {
    await stub.recordRevocation({ agent: STANDBY });
    const row = await runInDurableObject(stub, (_instance, state) =>
      state.storage.sql
        .exec<{ mode: string; standby_agent: string | null }>('SELECT mode, standby_agent FROM agent_wake WHERE agent = ?', PRIMARY)
        .one(),
    );
    expect(row).toEqual({ mode: WakeMode.None, standby_agent: null });
  });

  it('makes a hand-off whose copy is still unread unread again for the primary', async () => {
    expectOk(await receiveOwnerText({ stub, text: `@${PRIMARY} ${OWNER_TEXT}` }));
    expect(expectOk(await stub.checkInbox({ connection: connectionFor({ agent: PRIMARY }) })).status).toBe(InboxStatus.Empty);
    await stub.recordRevocation({ agent: STANDBY });
    const inbox = expectOk(await stub.checkInbox({ connection: connectionFor({ agent: PRIMARY }) }));
    expect(inbox.status).toBe(InboxStatus.New);
    expect(inbox.messages).toHaveLength(1);
  });

  it('deletes the unread standby copies of the revoked agent', async () => {
    expectOk(await receiveOwnerText({ stub, text: `@${PRIMARY} ${OWNER_TEXT}` }));
    await stub.recordRevocation({ agent: STANDBY });
    expect(await copyCount({ agent: STANDBY })).toBe(0);
  });

  it('refuses a get_messages admitted by the directory before the revocation reached the object', async () => {
    expectOk(await receiveOwnerText({ stub, text: `@${PRIMARY} ${OWNER_TEXT}` }));
    await stub.recordRevocation({ agent: STANDBY });
    const outcome = await stub.getMessages({ connection: connectionFor({ agent: STANDBY }), limit: 10 });
    expect(outcome).toMatchObject({ ok: false, errorCode: InboxErrorCode.NotFound });
  });

  it('keeps a hand-off whose copy the standby already read', async () => {
    expectOk(await receiveOwnerText({ stub, text: `@${PRIMARY} ${OWNER_TEXT}` }));
    expect(expectOk(await stub.checkInbox({ connection: connectionFor({ agent: STANDBY }) })).messages).toHaveLength(1);
    await stub.recordRevocation({ agent: STANDBY });
    expect(expectOk(await stub.checkInbox({ connection: connectionFor({ agent: PRIMARY }) })).status).toBe(InboxStatus.Empty);
  });
});
