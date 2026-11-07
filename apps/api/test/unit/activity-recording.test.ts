import type { AgentWaker } from '@zapbip/core';
import { AgentWakeReason, WakeOutcome } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { recordWakerActivity } from '../../src/account-inbox/activity-recording';
import { ActivityMetric } from '../../src/contract/activity-metric';

const AGENT = 'alpha';

function wakerAnswering(input: { outcome: WakeOutcome }): AgentWaker {
  return { notify: async () => input.outcome, hasFailedWake: async () => false, pushesEveryMessage: async () => false };
}

describe('wake activity', () => {
  it.each([
    { outcome: WakeOutcome.Woken, metric: ActivityMetric.WakesWoken },
    { outcome: WakeOutcome.Unreached, metric: ActivityMetric.WakesUnreached },
  ])('counts a notify that answered $outcome as $metric', async ({ outcome, metric }) => {
    const recorded: ActivityMetric[] = [];
    const waker = recordWakerActivity({ waker: wakerAnswering({ outcome }), record: (activity) => recorded.push(activity.metric) });
    await waker.notify({ agent: AGENT, reason: AgentWakeReason.MessageWaiting });
    expect(recorded).toEqual([metric]);
  });

  it('counts nothing for a question that is not a wake attempt', async () => {
    const recorded: ActivityMetric[] = [];
    const waker = recordWakerActivity({
      waker: wakerAnswering({ outcome: WakeOutcome.Woken }),
      record: (activity) => recorded.push(activity.metric),
    });
    await waker.hasFailedWake({ agent: AGENT });
    await waker.pushesEveryMessage({ agent: AGENT });
    expect(recorded).toEqual([]);
  });
});
