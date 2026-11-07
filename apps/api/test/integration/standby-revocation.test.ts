import { renderAccountReply, renderCopy, type AgentName } from '@zapbip/core';
import {
  AccountReplyIntent,
  AccountReplyParameter,
  InboxCopyKey,
  InboxErrorCode,
  InboxStatus,
  OwnerLocale,
  ReplyKind,
  WakeMode,
} from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import { hashConnectionSecret } from '../../src/adapters/platform/hash';
import type { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readScreen, receiveOwnerText } from '../support/inbox-session';
import { applyWakeDirectory, GROK_TOKEN, GROK_URL, WAKE_ACCOUNT, enableGrokWake, expectOk, wakeStub } from '../support/wake-session';
import { connectionOf } from '../support/workers-env';
import { UNAUTHORIZED_BODY } from '../../src/contract/constants';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { postMcp } from './mcp-fixtures';
import { bindingsWith, deliver, findAccounts, latestMcpPath, screenTextsOf, WA_ID } from './owner-inbound-fixtures';

const PRIMARY: AgentName = 'grok-web';
const STANDBY: AgentName = 'grok-bot';
const OWNER_TEXT = 'depois da revogacao';
const STATUS_UNAUTHORIZED = 401;
const RECREATED_SECRET = `zb_conn_${'R'.repeat(43)}`;

let stub: DurableObjectStub<DevAccountInbox>;
let accountId = WAKE_ACCOUNT;

function connectionFor(input: { agent: AgentName }) {
  return connectionOf({ accountId, agent: input.agent });
}

function setStandby(input: { agent: AgentName; standbyAgent: AgentName }) {
  return stub.setWake({
    connection: connectionFor({ agent: input.agent }),
    setting: { mode: WakeMode.Standby, url: null, token: null, intervalMinutes: null, standbyAgent: input.standbyAgent },
  });
}

async function revoke(input: { agent: AgentName }): Promise<void> {
  await stub.recordRevocation(input);
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

function countHandoffsTo(input: { agent: AgentName }): Promise<number> {
  return runInDurableObject(
    stub,
    (_instance, state) =>
      state.storage.sql.exec<{ total: number }>('SELECT COUNT(*) AS total FROM inbox_messages WHERE handed_to = ?', input.agent).one()
        .total,
  );
}

beforeEach(applyWakeDirectory);

beforeEach(async () => {
  accountId = WAKE_ACCOUNT;
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

  it('starts a recreated name with no standby or hand-off state of the old connection', async () => {
    expectOk(await receiveOwnerText({ stub, text: `@${PRIMARY} ${OWNER_TEXT}` }));
    expectOk(await stub.checkInbox({ connection: connectionFor({ agent: STANDBY }) }));
    await revoke({ agent: STANDBY });
    await stub.recordCreation({ agent: STANDBY, secretDigest: await hashConnectionSecret({ secret: RECREATED_SECRET }) });
    expect(await countRows({ agent: STANDBY })).toEqual({ wakes: 0, copies: 0 });
    expect(await countHandoffsTo({ agent: STANDBY })).toBe(0);
  });

  it('keeps handing off after another connection is revoked', async () => {
    await revoke({ agent: 'claude' });
    expectOk(await receiveOwnerText({ stub, text: `@${PRIMARY} ${OWNER_TEXT}` }));
    expect(await countRows({ agent: STANDBY })).toMatchObject({ wakes: 1, copies: 1 });
  });
});

describe('revoking the standby by the owner command', () => {
  const bindings = bindingsWith({ waitlistEnabled: false });
  const revokedReply = renderAccountReply({
    reply: {
      intent: AccountReplyIntent.Revoked,
      kind: ReplyKind.Text,
      locale: OwnerLocale.PortugueseBrazil,
      parameters: { [AccountReplyParameter.AgentName]: STANDBY },
      menuRows: [],
    },
  });
  let standbyMcpPath: string;

  async function accountIdOfOwner(): Promise<string> {
    const [account] = await findAccounts({ waId: WA_ID });
    if (account === undefined) throw new Error('account is missing');
    return account.accountId;
  }

  async function enableWebhook(input: { agent: AgentName }) {
    return expectOk(
      await stub.setWake({
        connection: connectionFor({ agent: input.agent }),
        setting: { mode: WakeMode.Webhook, url: GROK_URL, token: GROK_TOKEN, intervalMinutes: null, standbyAgent: null },
      }),
    );
  }

  beforeEach(async () => {
    await seedWhatsAppNumber();
    await deliver({ bindings, text: `novo agente ${PRIMARY}` });
    await deliver({ bindings, text: `novo agente ${STANDBY}` });
    accountId = await accountIdOfOwner();
    standbyMcpPath = await latestMcpPath({ accountId });
    stub = wakeStub({ accountId });
    await enableWebhook({ agent: STANDBY });
    expectOk(await setStandby({ agent: PRIMARY, standbyAgent: STANDBY }));
  });

  afterEach(async () => {
    await reset();
  });

  it('answers the revoke command and drops the standby wake row', async () => {
    await deliver({ bindings, text: `revogar ${STANDBY}` });
    expect(await screenTextsOf({ accountId })).toContain(revokedReply);
    expect(await countRows({ agent: STANDBY })).toEqual({ wakes: 0, copies: 0 });
  });

  it('keeps the message with the primary and tells the owner after the revoke command', async () => {
    await deliver({ bindings, text: `revogar ${STANDBY}` });
    await deliver({ bindings, text: `@${PRIMARY} ${OWNER_TEXT}` });
    const primaryInbox = expectOk(await stub.checkInbox({ connection: connectionFor({ agent: PRIMARY }) }));
    const notListening = renderCopy({
      key: InboxCopyKey.AgentNotListening,
      locale: OwnerLocale.PortugueseBrazil,
      values: { agent: PRIMARY },
    });
    expect(await countRows({ agent: STANDBY })).toEqual({ wakes: 0, copies: 0 });
    expect(primaryInbox.messages).toHaveLength(1);
    expect(await screenTextsOf({ accountId })).toContain(notListening);
  });

  it('refuses the revoked name as a new standby, like an unknown connection', async () => {
    await deliver({ bindings, text: `revogar ${STANDBY}` });
    const outcome = await setStandby({ agent: PRIMARY, standbyAgent: STANDBY });
    expect(outcome).toMatchObject({ ok: false, errorCode: InboxErrorCode.InvalidInput });
    expect(outcome.ok ? '' : outcome.message).toContain('standby_agent');
    expect(outcome.ok ? '' : outcome.message).toContain('not connected to this account');
  });

  it('keeps the standby and its wake mode when the owner rotates its link', async () => {
    await deliver({ bindings, text: `girar ${STANDBY}` });
    expect(await countRows({ agent: STANDBY })).toMatchObject({ wakes: 1 });
    await deliver({ bindings, text: `@${PRIMARY} ${OWNER_TEXT}` });
    expect(await countRows({ agent: STANDBY })).toMatchObject({ wakes: 1, copies: 1 });
  });

  it('answers 401 to the secret of the revoked standby', async () => {
    expect((await postMcp({ path: standbyMcpPath })).status).not.toBe(STATUS_UNAUTHORIZED);
    await deliver({ bindings, text: `revogar ${STANDBY}` });
    const response = await postMcp({ path: standbyMcpPath });
    expect(response.status).toBe(STATUS_UNAUTHORIZED);
    expect(await response.text()).toBe(JSON.stringify(UNAUTHORIZED_BODY));
  });
});
