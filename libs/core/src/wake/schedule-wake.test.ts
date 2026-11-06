import { SECOND_MS, WakeLogEventName, WakeOutcome } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { WAKE_DEBOUNCE_MS, WAKE_LEASE_MS } from './constants';
import { scheduleWake } from './schedule-wake';
import { createWakeEnvironment, setWebhook, type WakeEnvironment } from './testing/wake-fixtures';

const AGENT = 'claude-code';
const HALF_SECOND_MS = SECOND_MS / 2;

function notify(input: { wakeEnvironment: WakeEnvironment; agent?: string }) {
  const { wakeEnvironment, agent = AGENT } = input;
  return scheduleWake({ ...wakeEnvironment.context, agent });
}

async function notifyEvery(input: { wakeEnvironment: WakeEnvironment; count: number; gapMs: number }): Promise<WakeOutcome[]> {
  const { wakeEnvironment, count, gapMs } = input;
  const outcomes: WakeOutcome[] = [];
  await Array.from({ length: count }).reduce<Promise<void>>(async (previous) => {
    await previous;
    await wakeEnvironment.environment.clock.advance({ ms: gapMs });
    outcomes.push(await notify({ wakeEnvironment }));
  }, Promise.resolve());
  return outcomes;
}

describe('scheduleWake', () => {
  test('five messages in two seconds make one job due three seconds after the first', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { clock } = wakeEnvironment.environment;
    await setWebhook({ wakeEnvironment, agent: AGENT });
    const firstMessageAt = clock.now();
    const firstOutcome = await notify({ wakeEnvironment });
    const laterOutcomes = await notifyEvery({ wakeEnvironment, count: 4, gapMs: HALF_SECOND_MS });
    expect([firstOutcome, ...laterOutcomes]).toEqual(Array(5).fill(WakeOutcome.Woken));
    expect(await wakeEnvironment.wake.repository.findJob({ agent: AGENT })).toEqual({
      agent: AGENT,
      dueAt: firstMessageAt + WAKE_DEBOUNCE_MS,
      attempt: 0,
      leaseUntil: null,
      rewake: false,
      lastOutcome: null,
    });
  });

  test('a steady stream never moves the due time', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { clock } = wakeEnvironment.environment;
    await setWebhook({ wakeEnvironment, agent: AGENT });
    const firstMessageAt = clock.now();
    await notify({ wakeEnvironment });
    await notifyEvery({ wakeEnvironment, count: 10, gapMs: SECOND_MS });
    const job = await wakeEnvironment.wake.repository.findJob({ agent: AGENT });
    expect(job?.dueAt).toBe(firstMessageAt + WAKE_DEBOUNCE_MS);
  });

  test('a message during a lease asks for one follow-up and keeps the due time', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { clock } = wakeEnvironment.environment;
    await setWebhook({ wakeEnvironment, agent: AGENT });
    await notify({ wakeEnvironment });
    const job = await wakeEnvironment.wake.repository.findJob({ agent: AGENT });
    if (job === null) throw new Error('expected a job');
    await wakeEnvironment.wake.repository.saveJob({ job: { ...job, leaseUntil: clock.now() + WAKE_LEASE_MS } });
    await notify({ wakeEnvironment });
    expect(await wakeEnvironment.wake.repository.findJob({ agent: AGENT })).toEqual({
      ...job,
      leaseUntil: clock.now() + WAKE_LEASE_MS,
      rewake: true,
    });
  });

  test('an agent without a webhook is unreached and gets no job', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    expect(await notify({ wakeEnvironment })).toBe(WakeOutcome.Unreached);
    expect(await wakeEnvironment.wake.repository.findJob({ agent: AGENT })).toBeNull();
  });

  test('two agents get one job each', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const startAt = wakeEnvironment.environment.clock.now();
    await Promise.all(['alpha', 'beta'].map((agent) => setWebhook({ wakeEnvironment, agent })));
    await Promise.all(['alpha', 'beta'].map((agent) => notify({ wakeEnvironment, agent })));
    const jobs = await Promise.all(['alpha', 'beta'].map((agent) => wakeEnvironment.wake.repository.findJob({ agent })));
    expect(jobs.map((job) => job?.dueAt)).toEqual([startAt + WAKE_DEBOUNCE_MS, startAt + WAKE_DEBOUNCE_MS]);
  });

  test('observes one scheduled event per new job and none for a joined message', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await setWebhook({ wakeEnvironment, agent: AGENT });
    await notify({ wakeEnvironment });
    await notify({ wakeEnvironment });
    expect(wakeEnvironment.observer.events.map((event) => event.name)).toEqual([WakeLogEventName.Scheduled]);
  });
});
