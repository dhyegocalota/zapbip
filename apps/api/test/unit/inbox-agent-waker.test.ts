import { storedWakeOf } from '@zapbip/core/wake-testing';
import { AgentWakeReason, MessageKind, OwnerLocale, WakeMode, WakeOutcome } from '@zapbip/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInboxAgentWaker } from '../../src/adapters/wake/inbox-agent-waker';
import { POLLING_AGENT, createHarness, firstCallArgument, type WakerHarness } from './waker-fixtures';

const { deliverToOwner } = vi.hoisted(() => ({ deliverToOwner: vi.fn() }));

vi.mock('@zapbip/core', async (importOriginal) => ({ ...(await importOriginal<typeof import('@zapbip/core')>()), deliverToOwner }));

let harness: WakerHarness;

function notify() {
  return createInboxAgentWaker(harness).notify({ agent: POLLING_AGENT, reason: AgentWakeReason.MessageWaiting });
}

beforeEach(() => {
  deliverToOwner.mockReset();
  harness = createHarness();
});

describe('inbox agent waker', () => {
  it('sends the note for a stale scheduled connection and leaves the inbox notice to core', async () => {
    await harness.wake.repository.saveWake({
      wake: storedWakeOf({
        agent: POLLING_AGENT,
        mode: WakeMode.Scheduled,
        intervalMinutes: 60,
        ownerLocale: OwnerLocale.PortugueseBrazil,
      }),
    });
    expect(await notify()).toBe(WakeOutcome.Unreached);
    expect(deliverToOwner).toHaveBeenCalledTimes(1);
    expect(firstCallArgument({ mock: deliverToOwner }).content.kind).toBe(MessageKind.Text);
  });

  it.each([WakeMode.None, WakeMode.Webhook, WakeMode.Standby])('sends no note for a %s connection', async (mode) => {
    await harness.wake.repository.saveWake({ wake: storedWakeOf({ agent: POLLING_AGENT, mode }) });
    expect(await notify()).toBe(WakeOutcome.Unreached);
    expect(deliverToOwner).not.toHaveBeenCalled();
  });

  it('sends no note for an agent without a stored wake', async () => {
    expect(await notify()).toBe(WakeOutcome.Unreached);
    expect(deliverToOwner).not.toHaveBeenCalled();
  });
});
