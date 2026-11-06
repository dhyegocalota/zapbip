import type { AgentWaker, StoredWake } from '@zapbip/core';
import { scheduledWakeOf, storedWakeOf } from '@zapbip/core/wake-testing';
import { AgentWakeReason, HOUR_MS, WakeMode, WakeOutcome, WakeRung } from '@zapbip/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDispatchingAgentWaker } from '../../src/adapters/wake/dispatching-agent-waker';
import { POLLING_AGENT, PRIMARY, STANDBY, createHarness, type WakerHarness } from './waker-fixtures';

const REQUEST = { agent: PRIMARY, reason: AgentWakeReason.MessageWaiting, messageId: 'm1' };
const STALE_AFTER_MS = 2 * HOUR_MS;

let harness: WakerHarness;
let spies: Record<WakeRung, ReturnType<typeof vi.fn<AgentWaker['notify']>>>;

function dispatcher(): AgentWaker {
  const wakers = Object.fromEntries(Object.values(WakeRung).map((rung) => [rung, { notify: spies[rung] }])) as unknown as Record<
    WakeRung,
    AgentWaker
  >;
  return createDispatchingAgentWaker({ wakers, repository: harness.wake.repository, clock: harness.clock });
}

async function dispatchTo(input: { wakes: StoredWake[]; request?: typeof REQUEST }): Promise<WakeRung[]> {
  await input.wakes.reduce((previous, wake) => previous.then(() => harness.wake.repository.saveWake({ wake })), Promise.resolve());
  await dispatcher().notify(input.request === undefined ? REQUEST : input.request);
  return Object.values(WakeRung).filter((rung) => spies[rung].mock.calls.length > 0);
}

beforeEach(() => {
  harness = createHarness();
  spies = Object.fromEntries(
    Object.values(WakeRung).map((rung) => [rung, vi.fn<AgentWaker['notify']>().mockResolvedValue(WakeOutcome.Woken)]),
  ) as typeof spies;
});

describe('dispatching agent waker', () => {
  it('picks the scheduled waker for a fresh scheduled connection', async () => {
    const wake = scheduledWakeOf({ agent: PRIMARY, lastPolledAt: harness.clock.now() });
    expect(await dispatchTo({ wakes: [wake] })).toEqual([WakeRung.Scheduled]);
  });

  it('picks the inbox waker for a stale scheduled connection', async () => {
    await dispatchTo({ wakes: [scheduledWakeOf({ agent: PRIMARY })] });
    spies[WakeRung.Scheduled].mockClear();
    harness.clock.set({ now: harness.clock.now() + STALE_AFTER_MS + 1 });
    await dispatcher().notify(REQUEST);
    expect(spies[WakeRung.Inbox]).toHaveBeenCalledTimes(1);
    expect(spies[WakeRung.Scheduled]).not.toHaveBeenCalled();
  });

  it('picks the standby waker when the standby is a serving connection', async () => {
    const wakes = [
      storedWakeOf({ agent: PRIMARY, mode: WakeMode.Standby, standbyAgent: STANDBY }),
      storedWakeOf({ agent: STANDBY, mode: WakeMode.Webhook }),
    ];
    expect(await dispatchTo({ wakes })).toEqual([WakeRung.Standby]);
  });

  it('picks the inbox waker when the standby is itself in standby mode', async () => {
    const wakes = [
      storedWakeOf({ agent: PRIMARY, mode: WakeMode.Standby, standbyAgent: STANDBY }),
      storedWakeOf({ agent: STANDBY, mode: WakeMode.Standby, standbyAgent: POLLING_AGENT }),
    ];
    expect(await dispatchTo({ wakes })).toEqual([WakeRung.Inbox]);
  });

  it('picks the inbox waker when the standby has no stored wake, as after a revocation', async () => {
    const wakes = [storedWakeOf({ agent: PRIMARY, mode: WakeMode.Standby, standbyAgent: STANDBY })];
    expect(await dispatchTo({ wakes })).toEqual([WakeRung.Inbox]);
  });

  it('picks the webhook waker for a webhook connection', async () => {
    expect(await dispatchTo({ wakes: [storedWakeOf({ agent: PRIMARY, mode: WakeMode.Webhook })] })).toEqual([WakeRung.Webhook]);
  });

  it('picks the inbox waker for mode none and for an unknown agent', async () => {
    expect(await dispatchTo({ wakes: [storedWakeOf({ agent: PRIMARY, mode: WakeMode.None })] })).toEqual([WakeRung.Inbox]);
    spies[WakeRung.Inbox].mockClear();
    expect(await dispatchTo({ wakes: [], request: { ...REQUEST, agent: 'unknown' } })).toEqual([WakeRung.Inbox]);
  });

  it('passes the request through unchanged and returns the waker outcome', async () => {
    spies[WakeRung.Webhook].mockResolvedValue(WakeOutcome.Unreached);
    await harness.wake.repository.saveWake({ wake: storedWakeOf({ agent: PRIMARY, mode: WakeMode.Webhook }) });
    expect(await dispatcher().notify(REQUEST)).toBe(WakeOutcome.Unreached);
    expect(spies[WakeRung.Webhook]).toHaveBeenCalledWith(REQUEST);
  });
});
