import {
  deliverToOwner,
  expectedDelayNoteCopy,
  observeUnsent,
  rethrowUnlessQueued,
  type AgentName,
  type AgentWaker,
  type CoreDependencies,
  type WakeDependencies,
} from '@zapbip/core';
import { IdPrefix, MessageKind, WakeLogEventName, WakeOutcome } from '@zapbip/types';

async function sendExpectedDelayNote(input: { dependencies: CoreDependencies; wake: WakeDependencies; agent: AgentName }): Promise<void> {
  const { dependencies, wake, agent } = input;
  const [stored, pollState] = await Promise.all([wake.repository.findWake({ agent }), wake.repository.findPollState({ agent })]);
  if (stored === null || pollState === null) throw new Error(`scheduled wake of ${agent} has no stored state`);
  const { intervalMinutes, ownerLocale } = stored;
  if (intervalMinutes === null) throw new Error(`scheduled wake of ${agent} has no interval_minutes`);
  if (ownerLocale === null) throw new Error(`scheduled wake of ${agent} has no owner_locale`);
  const elapsedSinceLastPollMs = pollState.hasPolled ? dependencies.clock.now() - pollState.lastPolledAt : null;
  const messageId = dependencies.ids.next({ prefix: IdPrefix.Message });
  await deliverToOwner({
    dependencies,
    ownerLocale,
    agent: null,
    messageId,
    content: {
      kind: MessageKind.Text,
      text: expectedDelayNoteCopy({ locale: ownerLocale, agent, intervalMinutes, elapsedSinceLastPollMs }),
    },
    replyToMessageId: null,
  }).catch((error: unknown) => rethrowUnlessQueued({ dependencies, messageId, error }));
}

export async function noteExpectedDelay(input: {
  dependencies: CoreDependencies;
  wake: WakeDependencies;
  agent: AgentName;
}): Promise<void> {
  const { dependencies, wake, agent } = input;
  try {
    await sendExpectedDelayNote({ dependencies, wake, agent });
  } catch {
    const stored = await wake.repository.findWake({ agent });
    observeUnsent({ observer: wake.observer, name: WakeLogEventName.NoticeFailed, stored, agent, attempt: 0 });
  }
}

export function createScheduledAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker {
  const { dependencies, wake } = input;
  return {
    notify: async ({ agent }) => {
      await noteExpectedDelay({ dependencies, wake, agent });
      return WakeOutcome.Woken;
    },
    hasFailedWake: async () => false,
    pushesEveryMessage: async () => false,
  };
}
