import { renderCopy, type AgentName } from '@zapbip/core';
import { InboxCopyKey, InboxErrorCode, InboxStatus, OwnerLocale, WakeMode } from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import type { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readScreen, receiveOwnerText } from '../support/inbox-session';
import { WAKE_ACCOUNT, enableGrokWake, expectOk, wakeStub } from '../support/wake-session';
import { connectionOf } from '../support/workers-env';

const PRIMARY: AgentName = 'grok-web';
const STANDBY: AgentName = 'grok-bot';
const OWNER_TEXT = 'depois da revogacao';

type RevocableAccount = { recordRevocation(input: { agent: AgentName }): Promise<void> };

let stub: DurableObjectStub<DevAccountInbox>;

function connectionFor(input: { agent: AgentName }) {
  return connectionOf({ accountId: WAKE_ACCOUNT, agent: input.agent });
}

function setStandby(input: { agent: AgentName; standbyAgent: AgentName }) {
  return stub.setWake({
    connection: connectionFor({ agent: input.agent }),
    setting: { mode: WakeMode.Standby, url: null, token: null, intervalMinutes: null, standbyAgent: input.standbyAgent },
  });
}

async function revoke(input: { agent: AgentName }): Promise<void> {
  await (stub as unknown as RevocableAccount).recordRevocation(input);
}

function countRows(input: { agent: AgentName }): Promise<{ wakes: number; copies: number }> {
  return runInDurableObject(stub, (_instance, state) => ({
    wakes: state.storage.sql.exec<{ total: number }>('SELECT COUNT(*) AS total FROM agent_wake WHERE agent = ?', input.agent).one().total,
    copies: state.storage.sql
      .exec<{ total: number }>(
        'SELECT COUNT(*) AS total FROM inbox_messages WHERE agent = ? AND origin_message_id IS NOT NULL',
        input.agent,
      )
      .one().total,
  }));
}

beforeEach(async () => {
  stub = wakeStub({});
  await enableGrokWake({ stub, agent: STANDBY });
  expectOk(await setStandby({ agent: PRIMARY, standbyAgent: STANDBY }));
});

afterEach(async () => {
  await reset();
});

describe('revoking the standby', () => {
  it('stops the hand-off: no copy, the message stays with the primary and the owner is told', async () => {
    await revoke({ agent: STANDBY });
    expectOk(await receiveOwnerText({ stub, text: `@${PRIMARY} ${OWNER_TEXT}` }));
    const primaryInbox = expectOk(await stub.checkInbox({ connection: connectionFor({ agent: PRIMARY }) }));
    const notListening = renderCopy({
      key: InboxCopyKey.AgentNotListening,
      locale: OwnerLocale.PortugueseBrazil,
      values: { agent: PRIMARY },
    });
    expect(await countRows({ agent: STANDBY })).toEqual({ wakes: 0, copies: 0 });
    expect(primaryInbox.status).toBe(InboxStatus.New);
    expect(primaryInbox.messages).toHaveLength(1);
    expect((await readScreen({ stub })).map((entry) => entry.text)).toContain(notListening);
  });

  it('refuses a new standby that was revoked, with the same message as an unknown connection', async () => {
    await revoke({ agent: STANDBY });
    const outcome = await setStandby({ agent: 'claude', standbyAgent: STANDBY });
    expect(outcome).toMatchObject({ ok: false, errorCode: InboxErrorCode.InvalidInput });
    expect(outcome.ok ? '' : outcome.message).toContain('standby_agent');
    expect(outcome.ok ? '' : outcome.message).toContain('not connected to this account');
  });

  it('keeps handing off after another connection is revoked', async () => {
    await revoke({ agent: 'claude' });
    expectOk(await receiveOwnerText({ stub, text: `@${PRIMARY} ${OWNER_TEXT}` }));
    expect(await countRows({ agent: STANDBY })).toMatchObject({ wakes: 1, copies: 1 });
  });
});
