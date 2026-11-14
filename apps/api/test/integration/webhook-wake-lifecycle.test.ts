import type { WakeTransport } from '@zapbip/core';
import { ReplyStatus, WakeAttemptOutcome, WakeStatus } from '@zapbip/types';
import { evictDurableObject, reset, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import { advanceClock, receiveOwnerText } from '../support/inbox-session';
import {
  ACCEPTED,
  UNAUTHORIZED,
  DEBOUNCE_ADVANCE_MS,
  WAKE_ACCOUNT,
  WAKE_AGENT,
  enablePinnedWake,
  expectOk,
  mentionText,
  readLastRequestedAt,
  readRequests,
  readWakeJobs,
  readWakeNotices,
  readWakeRow,
  replaceWakeDependencies,
  wakeStub,
  applyWakeDirectory,
} from '../support/wake-session';
import { connectionOf } from '../support/workers-env';
import { applyDirectoryMigration } from '../support/seed';

const FAILED_RETRY_MS = 600_000;
const LEASE_MS = 15_000;
const LEASE_PAST_MS = 16_000;
const MIN_INTERVAL_MS = 60_000;
const WAITER_TIMEOUT_MS = 30_000;
const MAX_LEASE_POLLS = 1_000;

let stub: DurableObjectStub<DevAccountInbox>;

async function ownerMessage(): Promise<void> {
  expectOk(await receiveOwnerText({ stub, text: mentionText({ text: 'oi' }) }));
}

async function alarmAfter(input: { advanceMs: number }): Promise<void> {
  await advanceClock({ stub, advanceMs: input.advanceMs });
  await runDurableObjectAlarm(stub);
}

async function untilLeased(input: { polls: number }): Promise<void> {
  if (input.polls === 0) throw new Error('the job was never leased');
  const jobs = await readWakeJobs({ stub });
  const isLeased = jobs.some((job) => job.lease_until !== null);
  if (isLeased) return;
  await untilLeased({ polls: input.polls - 1 });
}

beforeEach(applyWakeDirectory);

beforeEach(async () => {
  stub = wakeStub({});
  await enablePinnedWake({ stub });
});

afterEach(async () => {
  await reset();
});

describe('webhook wake lifecycle', () => {
  it('box 184: sends exactly once after the object restarts while a job holds a lease', async () => {
    await ownerMessage();
    await runInDurableObject(stub, (_instance, state) => {
      state.storage.sql.exec('UPDATE wake_jobs SET lease_until = ?', Date.now() + LEASE_MS);
    });
    await evictDurableObject(stub);
    await stub.devScriptWake({ agent: WAKE_AGENT, responses: [ACCEPTED, ACCEPTED] });
    await alarmAfter({ advanceMs: DEBOUNCE_ADVANCE_MS });
    expect(await readRequests({ stub })).toEqual([]);
    await alarmAfter({ advanceMs: LEASE_PAST_MS });
    expect(await readRequests({ stub })).toHaveLength(1);
    expect(await readWakeJobs({ stub })).toEqual([]);
  });

  it('box 261: a second refusal after an object restart leaves one notice and a delivery returns to active', async () => {
    await stub.devScriptWake({ agent: WAKE_AGENT, responses: [UNAUTHORIZED] });
    await ownerMessage();
    await alarmAfter({ advanceMs: DEBOUNCE_ADVANCE_MS });
    expect((await readWakeRow({ stub })).status).toBe(WakeStatus.Failing);
    await evictDurableObject(stub);
    await stub.devScriptWake({ agent: WAKE_AGENT, responses: [UNAUTHORIZED, ACCEPTED] });
    await ownerMessage();
    await alarmAfter({ advanceMs: FAILED_RETRY_MS });
    expect((await readWakeRow({ stub })).status).toBe(WakeStatus.Failing);
    expect(await readWakeNotices({ stub })).toBe(1);
    await ownerMessage();
    await alarmAfter({ advanceMs: FAILED_RETRY_MS });
    expect((await readWakeRow({ stub })).status).toBe(WakeStatus.Active);
    expect(await readWakeNotices({ stub })).toBe(1);
    expect(await readWakeJobs({ stub })).toEqual([]);
  });

  it('box 183: leaves one follow-up job, held back by the interval, when a message lands during a delayed 200', async () => {
    const sentAt: number[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gatedTransport: WakeTransport = {
      send: async ({ nowMs }) => {
        sentAt.push(nowMs);
        await gate;
        return { outcome: WakeAttemptOutcome.Delivered, statusCode: 200, retryAfterMs: null, timedOut: false };
      },
    };
    await replaceWakeDependencies({ stub, patch: { transport: gatedTransport } });
    await ownerMessage();
    await advanceClock({ stub, advanceMs: DEBOUNCE_ADVANCE_MS });
    const running = runDurableObjectAlarm(stub);
    await untilLeased({ polls: MAX_LEASE_POLLS });
    expectOk(await stub.checkInbox({ connection: connectionOf({ accountId: WAKE_ACCOUNT, agent: WAKE_AGENT }) }));
    await ownerMessage();
    expect((await readWakeJobs({ stub })).map((job) => job.rewake)).toEqual([1]);
    release();
    await running;
    const [followUp] = await readWakeJobs({ stub });
    expect(followUp).toMatchObject({ attempt: 0, rewake: 0, lease_until: null });
    expect(followUp!.due_at - (await readLastRequestedAt({ stub }))).toBeGreaterThanOrEqual(MIN_INTERVAL_MS);
    await alarmAfter({ advanceMs: MIN_INTERVAL_MS });
    expect(sentAt).toHaveLength(2);
  });

  it('box 179: drops the job without a request when a wait_for_reply waiter is live at the alarm', async () => {
    await stub.devScriptWake({ agent: WAKE_AGENT, responses: [ACCEPTED] });
    await ownerMessage();
    const waiting = stub.waitForReply({
      connection: connectionOf({ accountId: WAKE_ACCOUNT, agent: WAKE_AGENT }),
      questionId: null,
      timeoutMs: WAITER_TIMEOUT_MS,
    });
    await alarmAfter({ advanceMs: DEBOUNCE_ADVANCE_MS });
    expect(await readRequests({ stub })).toEqual([]);
    expect(await readWakeJobs({ stub })).toEqual([]);
    await ownerMessage();
    expect(expectOk(await waiting).status).toBe(ReplyStatus.Message);
  });
});
