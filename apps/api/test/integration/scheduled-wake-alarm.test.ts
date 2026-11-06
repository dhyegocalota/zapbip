import {
  QUEUE_RETENTION_MS,
  STALE_POLL_INTERVAL_MULTIPLE,
  WAKE_COPY,
  renderCopy,
  type AgentName,
  type CoreDependencies,
  type WakeDependencies,
} from '@zapbip/core';
import { HOUR_MS, InboxCopyKey, MINUTE_MS, OwnerLocale, WakeCopyKey, WakeMode } from '@zapbip/types';
import { abortAllDurableObjects, reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DurableClock } from '../../src/adapters/platform/clock';
import { advanceClock, openWindow, readScreen, receiveOwnerText } from '../support/inbox-session';
import { accountInboxStub, connectionOf } from '../support/workers-env';

const ACCOUNT = 'acc_scheduled';
const POLLING_AGENT: AgentName = 'chatgpt';
const OTHER_AGENT: AgentName = 'claude';
const INTERVAL_MINUTES = 60;
const STALE_ADVANCE_MS = STALE_POLL_INTERVAL_MULTIPLE * INTERVAL_MINUTES * MINUTE_MS + MINUTE_MS;
const STALE_DEADLINE_OFFSET_MS = STALE_POLL_INTERVAL_MULTIPLE * INTERVAL_MINUTES * MINUTE_MS;
const STALE_NOTICE_FRAGMENT = 'parou de olhar a caixa';
const HOURLY_FRAGMENT = WAKE_COPY[WakeCopyKey.CadenceHourly][OwnerLocale.PortugueseBrazil];
const OWNER_TEXT = 'oi';
const EXPIRY_SWEEP_STEP = 'expiry_sweep';
const STALE_NOTICE_STEP = 'stale_notice';

const alarmSteps: string[] = [];

type LastPollRow = { last_polled_at: number; has_polled: number; poller_stale_notified: number };

const stub = () => accountInboxStub({ accountId: ACCOUNT });

function expectOk<Value>(outcome: { ok: true; value: Value } | { ok: false; errorCode: string; message: string }): Value {
  if (!outcome.ok) throw new Error(`expected ok, received ${outcome.errorCode}: ${outcome.message}`);
  return outcome.value;
}

async function scheduleAgent(input: { agent: AgentName }): Promise<void> {
  expectOk(
    await stub().setWake({
      connection: connectionOf({ accountId: ACCOUNT, agent: input.agent }),
      setting: { mode: WakeMode.Scheduled, url: null, token: null, intervalMinutes: INTERVAL_MINUTES, standbyAgent: null },
    }),
  );
}

async function pollInbox(input: { agent: AgentName }): Promise<void> {
  expectOk(await stub().checkInbox({ connection: connectionOf({ accountId: ACCOUNT, agent: input.agent }) }));
}

async function screenTexts(): Promise<string[]> {
  return (await readScreen({ stub: stub() })).map((entry) => entry.text);
}

async function countStaleNotices(): Promise<number> {
  return (await screenTexts()).filter((text) => text.includes(STALE_NOTICE_FRAGMENT)).length;
}

function readPollRow(input: { agent: AgentName }): Promise<LastPollRow> {
  return runInDurableObject(stub(), (_instance, state) =>
    state.storage.sql
      .exec<LastPollRow>('SELECT last_polled_at, has_polled, poller_stale_notified FROM agent_wake WHERE agent = ?', input.agent)
      .one(),
  );
}

function readArmedAlarm(): Promise<number | null> {
  return runInDurableObject(stub(), (_instance, state) => state.storage.getAlarm());
}

function toRealTime(input: { clockTime: number }): Promise<number> {
  return runInDurableObject(stub(), (instance) => (instance as unknown as { clock: DurableClock }).clock.toRealTime(input));
}

function recordAlarmSteps(): Promise<void> {
  alarmSteps.length = 0;
  return runInDurableObject(stub(), (instance) => {
    const { dependencies, wake } = instance as unknown as { dependencies: CoreDependencies; wake: WakeDependencies };
    const sweepQuestions = dependencies.repository.deleteQuestionsAskedBefore.bind(dependencies.repository);
    const markNotified = wake.repository.markStaleNotified.bind(wake.repository);
    dependencies.repository.deleteQuestionsAskedBefore = async (input) => {
      alarmSteps.push(EXPIRY_SWEEP_STEP);
      return sweepQuestions(input);
    };
    wake.repository.markStaleNotified = async (input) => {
      alarmSteps.push(STALE_NOTICE_STEP);
      return markNotified(input);
    };
  });
}

async function alarmAfter(input: { advanceMs: number }): Promise<void> {
  await advanceClock({ stub: stub(), advanceMs: input.advanceMs });
  await runDurableObjectAlarm(stub());
}

afterEach(async () => {
  await reset();
});

describe('scheduled poller alarm', () => {
  beforeEach(async () => {
    await openWindow({ stub: stub() });
    await scheduleAgent({ agent: POLLING_AGENT });
  });

  it('sends one stale notice when the poller stopped', async () => {
    await alarmAfter({ advanceMs: STALE_ADVANCE_MS });
    expect(await countStaleNotices()).toBe(1);
    expect((await screenTexts()).find((text) => text.includes(STALE_NOTICE_FRAGMENT))).toContain(POLLING_AGENT);
  });

  it('runs the expiry sweep before the stale notice in the same alarm', async () => {
    await recordAlarmSteps();
    await alarmAfter({ advanceMs: STALE_ADVANCE_MS });
    expect(alarmSteps).toEqual([EXPIRY_SWEEP_STEP, STALE_NOTICE_STEP]);
  });

  it('does not repeat the stale notice on the next alarm', async () => {
    await alarmAfter({ advanceMs: STALE_ADVANCE_MS });
    await alarmAfter({ advanceMs: HOUR_MS });
    expect(await countStaleNotices()).toBe(1);
    expect((await readPollRow({ agent: POLLING_AGENT })).poller_stale_notified).toBe(1);
  });

  it('sends nothing before the poller is stale', async () => {
    await alarmAfter({ advanceMs: STALE_DEADLINE_OFFSET_MS - MINUTE_MS });
    expect(await countStaleNotices()).toBe(0);
  });

  it('starts a new episode after a poll', async () => {
    await alarmAfter({ advanceMs: STALE_ADVANCE_MS });
    await pollInbox({ agent: POLLING_AGENT });
    expect(await readPollRow({ agent: POLLING_AGENT })).toMatchObject({ has_polled: 1, poller_stale_notified: 0 });
    await alarmAfter({ advanceMs: STALE_ADVANCE_MS });
    expect(await countStaleNotices()).toBe(2);
  });

  it('arms the alarm at the stale deadline after set_wake', async () => {
    const { last_polled_at: lastPolledAt } = await readPollRow({ agent: POLLING_AGENT });
    expect(await readArmedAlarm()).toBe(await toRealTime({ clockTime: lastPolledAt + STALE_DEADLINE_OFFSET_MS }));
  });

  it('arms the alarm again after the object is evicted and sends the notice', async () => {
    const { last_polled_at: lastPolledAt } = await readPollRow({ agent: POLLING_AGENT });
    await abortAllDurableObjects();
    expect(await readArmedAlarm()).toBe(await toRealTime({ clockTime: lastPolledAt + STALE_DEADLINE_OFFSET_MS }));
    await alarmAfter({ advanceMs: STALE_ADVANCE_MS });
    expect(await countStaleNotices()).toBe(1);
  });
});

describe('scheduled poller deadline against the queue expiry', () => {
  it('arms the alarm at the poller deadline when it is earlier than the queue expiry', async () => {
    expectOk(
      await stub().sendText({
        connection: connectionOf({ accountId: ACCOUNT, agent: OTHER_AGENT }),
        text: OWNER_TEXT,
        replyToMessageId: null,
      }),
    );
    await scheduleAgent({ agent: POLLING_AGENT });
    const { last_polled_at: lastPolledAt } = await readPollRow({ agent: POLLING_AGENT });
    expect(QUEUE_RETENTION_MS).toBeGreaterThan(STALE_DEADLINE_OFFSET_MS);
    expect(await readArmedAlarm()).toBe(await toRealTime({ clockTime: lastPolledAt + STALE_DEADLINE_OFFSET_MS }));
  });
});

describe('expected delay note and the inbox notice', () => {
  beforeEach(async () => {
    await scheduleAgent({ agent: POLLING_AGENT });
  });

  it('tells the owner the cadence when a fresh scheduled agent receives a message', async () => {
    expectOk(await receiveOwnerText({ stub: stub(), text: `@${POLLING_AGENT} ${OWNER_TEXT}` }));
    const texts = await screenTexts();
    const notListening = renderCopy({
      key: InboxCopyKey.AgentNotListening,
      locale: OwnerLocale.PortugueseBrazil,
      values: { agent: POLLING_AGENT },
    });
    expect(texts.filter((text) => text.includes(HOURLY_FRAGMENT))).toHaveLength(1);
    expect(texts).not.toContain(notListening);
  });

  it('sends the note and then the inbox notice when the poller is stale', async () => {
    await advanceClock({ stub: stub(), advanceMs: STALE_ADVANCE_MS });
    expectOk(await receiveOwnerText({ stub: stub(), text: `@${POLLING_AGENT} ${OWNER_TEXT}` }));
    const texts = await screenTexts();
    const notListening = renderCopy({
      key: InboxCopyKey.AgentNotListening,
      locale: OwnerLocale.PortugueseBrazil,
      values: { agent: POLLING_AGENT },
    });
    const noteIndex = texts.findIndex((text) => text.includes(HOURLY_FRAGMENT));
    const noticeIndex = texts.indexOf(notListening);
    expect(noteIndex).toBeGreaterThanOrEqual(0);
    expect(noticeIndex).toBeGreaterThan(noteIndex);
  });
});
