import {
  deliverToOwner,
  expectedDelayNoteCopy,
  type AgentName,
  type AgentWaker,
  type CoreDependencies,
  type WakeDependencies,
} from '@zapbip/core';
import { AgentWakeReason, IdPrefix, MessageKind, WakeOutcome } from '@zapbip/types';

export async function sendExpectedDelayNote(input: {
  dependencies: CoreDependencies;
  wake: WakeDependencies;
  agent: AgentName;
}): Promise<void> {
  const { dependencies, wake, agent } = input;
  const [stored, pollState] = await Promise.all([wake.repository.findWake({ agent }), wake.repository.findPollState({ agent })]);
  if (stored === null || pollState === null) throw new Error(`scheduled wake of ${agent} has no stored state`);
  const { intervalMinutes, ownerLocale } = stored;
  if (intervalMinutes === null) throw new Error(`scheduled wake of ${agent} has no interval_minutes`);
  if (ownerLocale === null) throw new Error(`scheduled wake of ${agent} has no owner_locale`);
  const elapsedSinceLastPollMs = pollState.hasPolled ? dependencies.clock.now() - pollState.lastPolledAt : null;
  await deliverToOwner({
    dependencies,
    ownerLocale,
    agent: null,
    messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
    content: {
      kind: MessageKind.Text,
      text: expectedDelayNoteCopy({ locale: ownerLocale, agent, intervalMinutes, elapsedSinceLastPollMs }),
    },
    replyToMessageId: null,
  });
}

export function createScheduledAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker {
  const { dependencies, wake } = input;
  return {
    notify: async ({ agent, reason }) => {
      if (reason === AgentWakeReason.StandbyFor) return WakeOutcome.Woken;
      await sendExpectedDelayNote({ dependencies, wake, agent });
      return WakeOutcome.Woken;
    },
    hasFailedWake: async () => false,
  };
}
