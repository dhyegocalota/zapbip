import { HOUR_MS, MessageKind, OwnerLocale, WakeMode } from '@zapbip/types';
import { describe, expect, test, vi } from 'vitest';
import { evaluatePollers, nextPollerDeadline } from './evaluate-pollers';
import { staleNoticeCopy } from './wake-copy';
import { scheduledWakeOf, storedWakeOf } from './testing/wake-doubles';
import { createWakeEnvironment, type WakeEnvironment } from './testing/wake-fixtures';

async function schedule(input: { wakeEnvironment: WakeEnvironment; agent: string; intervalMinutes?: number; ownerLocale?: OwnerLocale }) {
  const { wakeEnvironment, agent, intervalMinutes = 60, ownerLocale = OwnerLocale.PortugueseBrazil } = input;
  const { repository } = wakeEnvironment.wake;
  await repository.saveWake({ wake: scheduledWakeOf({ agent, intervalMinutes, ownerLocale }) });
  await repository.recordPoll({ agent, polledAt: wakeEnvironment.environment.clock.now(), ownerLocale });
}

function sessionTexts(input: { wakeEnvironment: WakeEnvironment }): string[] {
  return input.wakeEnvironment.environment.sender.sessions.flatMap((message) => (message.kind === MessageKind.Text ? [message.text] : []));
}

describe('evaluatePollers', () => {
  test('one stale notice per episode, with the agent and the elapsed time', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { clock } = wakeEnvironment.environment;
    await schedule({ wakeEnvironment, agent: 'chatgpt' });
    await clock.advance({ ms: 3 * HOUR_MS });
    const markStaleNotified = vi.spyOn(wakeEnvironment.wake.repository, 'markStaleNotified');
    await evaluatePollers(wakeEnvironment.context);
    expect(markStaleNotified).toHaveBeenCalledOnce();
    expect(sessionTexts({ wakeEnvironment })).toEqual([
      staleNoticeCopy({ locale: OwnerLocale.PortugueseBrazil, agent: 'chatgpt', elapsedSinceLastPollMs: 3 * HOUR_MS }),
    ]);
  });

  test('a second pass with no poll sends nothing and has no deadline', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await schedule({ wakeEnvironment, agent: 'chatgpt' });
    await wakeEnvironment.environment.clock.advance({ ms: 3 * HOUR_MS });
    await evaluatePollers(wakeEnvironment.context);
    expect(await evaluatePollers(wakeEnvironment.context)).toEqual({ nextDueAt: null });
    expect(sessionTexts({ wakeEnvironment })).toHaveLength(1);
  });

  test('a poll starts a new episode', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { clock } = wakeEnvironment.environment;
    await schedule({ wakeEnvironment, agent: 'chatgpt' });
    await clock.advance({ ms: 3 * HOUR_MS });
    await evaluatePollers(wakeEnvironment.context);
    await wakeEnvironment.wake.repository.recordPoll({
      agent: 'chatgpt',
      polledAt: clock.now(),
      ownerLocale: OwnerLocale.PortugueseBrazil,
    });
    await clock.advance({ ms: 3 * HOUR_MS });
    await evaluatePollers(wakeEnvironment.context);
    expect(sessionTexts({ wakeEnvironment })).toHaveLength(2);
  });

  test('a connection that never polled is told as never polled', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { clock } = wakeEnvironment.environment;
    await wakeEnvironment.wake.repository.saveWake({
      wake: scheduledWakeOf({ agent: 'chatgpt', ownerLocale: OwnerLocale.EnglishUs }),
    });
    await clock.advance({ ms: 2 * HOUR_MS });
    await evaluatePollers(wakeEnvironment.context);
    expect(sessionTexts({ wakeEnvironment })).toEqual([
      staleNoticeCopy({ locale: OwnerLocale.EnglishUs, agent: 'chatgpt', elapsedSinceLastPollMs: null }),
    ]);
  });

  test('the notice is in the locale of the wake', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await schedule({ wakeEnvironment, agent: 'chatgpt', ownerLocale: OwnerLocale.EnglishUs });
    await wakeEnvironment.environment.clock.advance({ ms: 2 * HOUR_MS });
    await evaluatePollers(wakeEnvironment.context);
    expect(sessionTexts({ wakeEnvironment })).toEqual([
      staleNoticeCopy({ locale: OwnerLocale.EnglishUs, agent: 'chatgpt', elapsedSinceLastPollMs: 2 * HOUR_MS }),
    ]);
  });

  test('the next deadline is the earliest of the connections not yet stale', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { clock } = wakeEnvironment.environment;
    const start = clock.now();
    await schedule({ wakeEnvironment, agent: 'chatgpt', intervalMinutes: 120 });
    await schedule({ wakeEnvironment, agent: 'hermes', intervalMinutes: 60 });
    expect(await evaluatePollers(wakeEnvironment.context)).toEqual({ nextDueAt: start + 2 * HOUR_MS });
  });

  test('a notified connection does not count in the deadline', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    const { clock } = wakeEnvironment.environment;
    await schedule({ wakeEnvironment, agent: 'hermes', intervalMinutes: 60 });
    await clock.advance({ ms: 2 * HOUR_MS });
    await schedule({ wakeEnvironment, agent: 'chatgpt', intervalMinutes: 120 });
    const expected = clock.now() + 4 * HOUR_MS;
    expect(await evaluatePollers(wakeEnvironment.context)).toEqual({ nextDueAt: expected });
  });

  test('nothing scheduled has no deadline and no notice', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    expect(await evaluatePollers(wakeEnvironment.context)).toEqual({ nextDueAt: null });
    expect(sessionTexts({ wakeEnvironment })).toEqual([]);
  });

  test('a webhook wake never goes stale', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await wakeEnvironment.wake.repository.saveWake({ wake: storedWakeOf({ agent: 'claude-code', mode: WakeMode.Webhook }) });
    await wakeEnvironment.environment.clock.advance({ ms: 10 * HOUR_MS });
    await evaluatePollers(wakeEnvironment.context);
    expect(sessionTexts({ wakeEnvironment })).toEqual([]);
  });
});

describe('nextPollerDeadline', () => {
  test('is null with no scheduled wake', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    expect(await nextPollerDeadline({ wake: wakeEnvironment.wake })).toBeNull();
  });

  test('equals the deadline evaluatePollers reports after a pass that changes nothing', async () => {
    const wakeEnvironment = await createWakeEnvironment();
    await schedule({ wakeEnvironment, agent: 'chatgpt', intervalMinutes: 120 });
    await schedule({ wakeEnvironment, agent: 'hermes', intervalMinutes: 60 });
    const { nextDueAt } = await evaluatePollers(wakeEnvironment.context);
    expect(await nextPollerDeadline({ wake: wakeEnvironment.wake })).toBe(nextDueAt);
  });
});
