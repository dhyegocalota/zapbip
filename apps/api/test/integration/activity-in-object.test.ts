import { WINDOW_MS } from '@zapbip/core';
import { WakeMode } from '@zapbip/types';
import { reset, runInDurableObject } from 'cloudflare:test';
import type { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ActivityMetric } from '../../src/contract/activity-metric';
import { advanceClock, nextChannelMessageId, openWindow, receiveOwnerText } from '../support/inbox-session';
import { failNextSessionSend } from '../support/session-send-probe';
import {
  ACCEPTED,
  WAKE_ACCOUNT,
  WAKE_AGENT,
  applyWakeDirectory,
  enableGrokWake,
  expectOk,
  mentionText,
  wakeStub,
} from '../support/wake-session';
import { connectionOf } from '../support/workers-env';

type MeterRow = { metric: ActivityMetric; count: number };

let stub: DurableObjectStub<DevAccountInbox>;

const connection = connectionOf({ accountId: WAKE_ACCOUNT, agent: WAKE_AGENT });
const OWNER_TEXT = 'oi';
const AGENT_TEXT = 'ola';
const QUESTION_OPTIONS = ['Sim', 'Nao'];

async function countOf(input: { metric: ActivityMetric }): Promise<number> {
  const rows = await runInDurableObject(stub, (_instance, state) =>
    state.storage.sql.exec<MeterRow>('SELECT metric, count FROM activity_meter WHERE metric = ?', input.metric).toArray(),
  );
  return rows.reduce((total, row) => total + row.count, 0);
}

function sendAgentText() {
  return stub.sendText({ connection, text: AGENT_TEXT, replyToMessageId: null });
}

beforeEach(async () => {
  await applyWakeDirectory();
  stub = wakeStub({});
});
afterEach(reset);

describe('activity meter in the account object', () => {
  it('counts an accepted owner message', async () => {
    expectOk(await receiveOwnerText({ stub, text: OWNER_TEXT }));
    expect(await countOf({ metric: ActivityMetric.MessagesIn })).toBe(1);
  });

  it('does not count a duplicate owner message', async () => {
    const channelMessageId = nextChannelMessageId();
    expectOk(await receiveOwnerText({ stub, text: OWNER_TEXT, channelMessageId }));
    expectOk(await receiveOwnerText({ stub, text: OWNER_TEXT, channelMessageId }));
    expect(await countOf({ metric: ActivityMetric.MessagesIn })).toBe(1);
  });

  it('counts a session send the channel accepted', async () => {
    await openWindow({ stub });
    expectOk(await sendAgentText());
    expect(await countOf({ metric: ActivityMetric.MessagesOut })).toBe(1);
  });

  it('counts a notice template sent outside the window', async () => {
    await openWindow({ stub });
    await advanceClock({ stub, advanceMs: WINDOW_MS });
    expectOk(await sendAgentText());
    expect(await countOf({ metric: ActivityMetric.TemplatesSentNotice })).toBe(1);
    expect(await countOf({ metric: ActivityMetric.MessagesOut })).toBe(0);
  });

  it('counts a question template sent outside the window', async () => {
    await openWindow({ stub });
    await advanceClock({ stub, advanceMs: WINDOW_MS });
    expectOk(
      await stub.ask({
        connection,
        text: 'Deploy?',
        options: QUESTION_OPTIONS,
        optionDescriptions: [null, null],
        timeoutMs: 50,
      }),
    );
    expect(await countOf({ metric: ActivityMetric.TemplatesSentQuestion })).toBe(1);
  });

  it('counts a send that failed at send time', async () => {
    await openWindow({ stub });
    await failNextSessionSend({ accountId: WAKE_ACCOUNT });
    await sendAgentText().catch(() => undefined);
    expect(await countOf({ metric: ActivityMetric.SendsFailed })).toBe(1);
    expect(await countOf({ metric: ActivityMetric.MessagesOut })).toBe(0);
  });

  it('counts a wake that woke the agent', async () => {
    await enableGrokWake({ stub });
    await stub.devScriptWake({ agent: WAKE_AGENT, responses: [ACCEPTED] });
    expectOk(await receiveOwnerText({ stub, text: mentionText({ text: OWNER_TEXT }) }));
    expect(await countOf({ metric: ActivityMetric.WakesWoken })).toBe(1);
  });

  it('counts a wake that did not reach the agent', async () => {
    expectOk(
      await stub.setWake({
        connection,
        setting: { mode: WakeMode.None, url: null, token: null, intervalMinutes: null, standbyAgent: null },
      }),
    );
    expectOk(await receiveOwnerText({ stub, text: mentionText({ text: OWNER_TEXT }) }));
    expect(await countOf({ metric: ActivityMetric.WakesUnreached })).toBe(1);
  });
});
