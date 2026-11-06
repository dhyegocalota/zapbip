import { notFound, ownerMessageIdOf, type AgentWaker, type CoreDependencies, type Message, type WakeDependencies } from '@zapbip/core';
import { AgentWakeReason, IdPrefix, WakeOutcome } from '@zapbip/types';

export function createStandbyAgentWaker(input: { dependencies: CoreDependencies; wake: WakeDependencies }): AgentWaker {
  const { dependencies, wake } = input;
  const { repository, ids } = dependencies;
  return {
    notify: async ({ agent, messageId }) => {
      if (messageId === undefined) return WakeOutcome.Unreached;
      const primary = await wake.repository.findWake({ agent });
      if (primary === null || primary.standbyAgent === null) return WakeOutcome.Unreached;
      const { standbyAgent } = primary;
      const message = await repository.findMessage({ messageId });
      if (message === null) throw notFound({ message: 'messageId: message not found' });
      const unreadBefore = await repository.countUnread({ agent: standbyAgent });
      const copy: Message = {
        ...message,
        messageId: ids.next({ prefix: IdPrefix.Message }),
        agent: standbyAgent,
        readByAgent: false,
        handedTo: null,
        originMessageId: ownerMessageIdOf({ message }),
      };
      await repository.insertHandoff({ copy, primaryAgent: agent, handedTo: standbyAgent });
      if (unreadBefore > 0) return WakeOutcome.Woken;
      return dependencies.waker.notify({ agent: standbyAgent, reason: AgentWakeReason.StandbyFor });
    },
    hasFailedWake: async () => false,
  };
}
