import { WAKE_SIGNAL_BODY, renderCopy, type AgentName } from '@zapbip/core';
import { InboxCopyKey, InboxErrorCode, InboxStatus, MessageKind, OwnerLocale, WakeMode } from '@zapbip/types';
import { reset, runDurableObjectAlarm } from 'cloudflare:test';
import type { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withRepository } from '../support/account-inbox';
import { advanceClock, readScreen, receiveOwnerText } from '../support/inbox-session';
import { ACCEPTED, DEBOUNCE_ADVANCE_MS, WAKE_ACCOUNT, enableGrokWake, expectOk, readRequests, wakeStub } from '../support/wake-session';
import { connectionOf } from '../support/workers-env';

const PRIMARY: AgentName = 'grok-web';
const STANDBY: AgentName = 'grok-bot';
const THIRD: AgentName = 'claude';
const OWNER_TEXT = 'segredo do dono';
const ANSWER_TEXT = 'feito';
const UNKNOWN_MESSAGE_ID = 'zz9';

let stub: DurableObjectStub<DevAccountInbox>;

function connectionFor(input: { agent: AgentName }) {
  return connectionOf({ accountId: WAKE_ACCOUNT, agent: input.agent });
}

async function setStandby(input: { agent: AgentName; standbyAgent: AgentName }): Promise<void> {
  expectOk(
    await stub.setWake({
      connection: connectionFor({ agent: input.agent }),
      setting: { mode: WakeMode.Standby, url: null, token: null, intervalMinutes: null, standbyAgent: input.standbyAgent },
    }),
  );
}

async function ownerWrites(input: { text: string }): Promise<string> {
  const { messageId } = expectOk(await receiveOwnerText({ stub, text: `@${PRIMARY} ${input.text}` }));
  if (messageId === null) throw new Error('owner message was not stored');
  return messageId;
}

async function checkInbox(input: { agent: AgentName }) {
  return expectOk(await stub.checkInbox({ connection: connectionFor({ agent: input.agent }) }));
}

async function replyingTo(input: { messageId: string }) {
  return stub.sendText({ connection: connectionFor({ agent: STANDBY }), text: ANSWER_TEXT, replyToMessageId: input.messageId });
}

function readStoredReplyTarget(input: { messageId: string }): Promise<string | null> {
  return withRepository({
    accountId: WAKE_ACCOUNT,
    run: async (repository) => {
      const stored = await repository.findMessage({ messageId: input.messageId });
      if (stored === null) throw new Error('reply was not stored');
      return stored.replyToMessageId;
    },
  });
}

async function alarmAfterDebounce(): Promise<void> {
  await advanceClock({ stub, advanceMs: DEBOUNCE_ADVANCE_MS });
  await runDurableObjectAlarm(stub);
}

beforeEach(async () => {
  stub = wakeStub({});
  await enableGrokWake({ stub, agent: STANDBY });
  await stub.devScriptWake({ agent: STANDBY, responses: [ACCEPTED, ACCEPTED] });
  await setStandby({ agent: PRIMARY, standbyAgent: STANDBY });
});

afterEach(async () => {
  await reset();
});

describe('standby handoff', () => {
  it('leaves the primary inbox empty and records the hand-off in its history', async () => {
    const ownerMessageId = await ownerWrites({ text: OWNER_TEXT });
    expect(await checkInbox({ agent: PRIMARY })).toEqual({ status: InboxStatus.Empty, messages: [] });
    const { history } = expectOk(await stub.getMessages({ connection: connectionFor({ agent: PRIMARY }), limit: 10 }));
    expect(history.find((message) => message.messageId === ownerMessageId)).toMatchObject({ handedTo: STANDBY });
  });

  it('gives the standby a copy with its own id that points at the owner message', async () => {
    const ownerMessageId = await ownerWrites({ text: OWNER_TEXT });
    const { status, messages } = await checkInbox({ agent: STANDBY });
    expect(status).toBe(InboxStatus.New);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ kind: MessageKind.Text, text: OWNER_TEXT, agent: STANDBY, originMessageId: ownerMessageId });
    expect(messages[0]!.messageId).not.toBe(ownerMessageId);
  });

  it('wakes the standby with the constant signal and never the primary', async () => {
    await ownerWrites({ text: OWNER_TEXT });
    await alarmAfterDebounce();
    const requests = await readRequests({ stub, agent: STANDBY });
    expect(requests.map((request) => request.body)).toEqual([WAKE_SIGNAL_BODY]);
    expect(await readRequests({ stub, agent: PRIMARY })).toEqual([]);
  });

  it('writes the copy but does not wake the standby again while it holds unread messages', async () => {
    await ownerWrites({ text: OWNER_TEXT });
    await alarmAfterDebounce();
    await ownerWrites({ text: ANSWER_TEXT });
    await alarmAfterDebounce();
    expect(await readRequests({ stub, agent: STANDBY })).toHaveLength(1);
    expect((await checkInbox({ agent: STANDBY })).messages).toHaveLength(2);
  });

  it('keeps the message with the primary and tells the owner when the standby became a standby itself', async () => {
    await enableGrokWake({ stub, agent: THIRD });
    await setStandby({ agent: STANDBY, standbyAgent: THIRD });
    await ownerWrites({ text: OWNER_TEXT });
    const primaryInbox = await checkInbox({ agent: PRIMARY });
    const notListening = renderCopy({
      key: InboxCopyKey.AgentNotListening,
      locale: OwnerLocale.PortugueseBrazil,
      values: { agent: PRIMARY },
    });
    expect(primaryInbox.messages).toHaveLength(1);
    expect((await checkInbox({ agent: STANDBY })).messages).toEqual([]);
    expect((await readScreen({ stub })).map((entry) => entry.text)).toContain(notListening);
  });
});

describe('replying from the standby', () => {
  let ownerMessageId: string;
  let copyMessageId: string;

  beforeEach(async () => {
    ownerMessageId = await ownerWrites({ text: OWNER_TEXT });
    copyMessageId = (await checkInbox({ agent: STANDBY })).messages[0]!.messageId;
  });

  it('resolves a reply to the copy id to the owner message', async () => {
    const reply = expectOk(await replyingTo({ messageId: copyMessageId }));
    expect(await readStoredReplyTarget({ messageId: reply.messageId })).toBe(ownerMessageId);
  });

  it('resolves a reply to the origin id to the same owner message', async () => {
    const reply = expectOk(await replyingTo({ messageId: ownerMessageId }));
    expect(await readStoredReplyTarget({ messageId: reply.messageId })).toBe(ownerMessageId);
  });

  it('refuses a reply to an unknown id', async () => {
    const outcome = await replyingTo({ messageId: UNKNOWN_MESSAGE_ID });
    expect(outcome).toMatchObject({ ok: false, errorCode: InboxErrorCode.NotFound });
    expect(outcome.ok ? '' : outcome.message).toContain('reply_to');
  });
});
