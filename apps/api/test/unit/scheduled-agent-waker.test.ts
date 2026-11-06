import type { DeliverToOwnerInput } from '@zapbip/core';
import { InboxError, WAKE_COPY } from '@zapbip/core';
import { storedWakeOf } from '@zapbip/core/wake-testing';
import {
  AgentWakeReason,
  ChannelErrorKind,
  HOUR_MS,
  MessageKind,
  OwnerLocale,
  WakeCopyKey,
  WakeLogEventName,
  WakeMode,
  WakeOutcome,
} from '@zapbip/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createScheduledAgentWaker } from '../../src/adapters/wake/scheduled-agent-waker';
import { POLLING_AGENT, createHarness, firstCallArgument, type WakerHarness } from './waker-fixtures';

const { deliverToOwner } = vi.hoisted(() => ({ deliverToOwner: vi.fn() }));

vi.mock('@zapbip/core', async (importOriginal) => ({ ...(await importOriginal<typeof import('@zapbip/core')>()), deliverToOwner }));

const INTERVAL_MINUTES = 60;
const THREE_HOURS_MS = 3 * HOUR_MS;

let harness: WakerHarness;

async function scheduleAgent(input: { ownerLocale: OwnerLocale }): Promise<void> {
  await harness.wake.repository.saveWake({
    wake: storedWakeOf({
      agent: POLLING_AGENT,
      mode: WakeMode.Scheduled,
      intervalMinutes: INTERVAL_MINUTES,
      ownerLocale: input.ownerLocale,
    }),
  });
}

function notify(input: { reason: AgentWakeReason }) {
  return createScheduledAgentWaker(harness).notify({ agent: POLLING_AGENT, reason: input.reason });
}

function sentNote(): string {
  const call = firstCallArgument<DeliverToOwnerInput>({ mock: deliverToOwner });
  if (call.content.kind !== MessageKind.Text) throw new Error('expected a text note');
  return call.content.text;
}

beforeEach(() => {
  deliverToOwner.mockReset();
  harness = createHarness();
});

describe('scheduled agent waker', () => {
  it('sends the cadence note to the owner and reports the agent woken', async () => {
    await scheduleAgent({ ownerLocale: OwnerLocale.PortugueseBrazil });
    expect(await notify({ reason: AgentWakeReason.MessageWaiting })).toBe(WakeOutcome.Woken);
    expect(deliverToOwner).toHaveBeenCalledTimes(1);
    expect(firstCallArgument<DeliverToOwnerInput>({ mock: deliverToOwner })).toMatchObject({
      agent: null,
      ownerLocale: OwnerLocale.PortugueseBrazil,
    });
    expect(sentNote()).toContain(POLLING_AGENT);
    expect(sentNote()).toContain(WAKE_COPY[WakeCopyKey.CadenceHourly][OwnerLocale.PortugueseBrazil]);
  });

  it('writes the note in english for an english identity', async () => {
    await scheduleAgent({ ownerLocale: OwnerLocale.EnglishUs });
    await notify({ reason: AgentWakeReason.MessageWaiting });
    expect(sentNote()).toContain(WAKE_COPY[WakeCopyKey.CadenceHourly][OwnerLocale.EnglishUs]);
  });

  it('carries the time since the last poll', async () => {
    await scheduleAgent({ ownerLocale: OwnerLocale.PortugueseBrazil });
    await harness.wake.repository.recordPoll({
      agent: POLLING_AGENT,
      polledAt: harness.clock.now() - THREE_HOURS_MS,
      ownerLocale: OwnerLocale.PortugueseBrazil,
    });
    await notify({ reason: AgentWakeReason.MessageWaiting });
    expect(sentNote()).toContain('há 3 h');
  });

  it('says the inbox was never checked when no poll was recorded', async () => {
    await scheduleAgent({ ownerLocale: OwnerLocale.PortugueseBrazil });
    await notify({ reason: AgentWakeReason.MessageWaiting });
    expect(sentNote()).toContain(WAKE_COPY[WakeCopyKey.NeverPolled][OwnerLocale.PortugueseBrazil]);
  });

  it('sends the cadence note for a standby wake too and reports the agent woken', async () => {
    await scheduleAgent({ ownerLocale: OwnerLocale.PortugueseBrazil });
    expect(await notify({ reason: AgentWakeReason.StandbyFor })).toBe(WakeOutcome.Woken);
    expect(deliverToOwner).toHaveBeenCalledTimes(1);
    expect(sentNote()).toContain(POLLING_AGENT);
  });

  it.each([
    ['a delivery failure', new InboxError({ code: ChannelErrorKind.DeliveryFailed, message: 'delivery failed for text' })],
    ['a plain error', new Error('boom')],
  ])('logs %s of the note, reports the agent woken and does not throw', async (_name, failure) => {
    await scheduleAgent({ ownerLocale: OwnerLocale.PortugueseBrazil });
    deliverToOwner.mockRejectedValue(failure);
    expect(await notify({ reason: AgentWakeReason.MessageWaiting })).toBe(WakeOutcome.Woken);
    expect(harness.observer.events).toMatchObject([{ name: WakeLogEventName.NoticeFailed, agent: POLLING_AGENT }]);
  });

  it('logs a missing stored wake instead of throwing', async () => {
    expect(await notify({ reason: AgentWakeReason.MessageWaiting })).toBe(WakeOutcome.Woken);
    expect(deliverToOwner).not.toHaveBeenCalled();
    expect(harness.observer.events).toMatchObject([{ name: WakeLogEventName.NoticeFailed, agent: POLLING_AGENT }]);
  });
});
