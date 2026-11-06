import { wakeRungFor, type AgentWaker, type WakeRepository } from '@zapbip/core';
import { WakeRung } from '@zapbip/types';

export type WakerByRung = Record<WakeRung, AgentWaker>;

export function createDispatchingAgentWaker(input: { wakers: WakerByRung; repository: WakeRepository }): AgentWaker {
  const { wakers, repository } = input;
  return {
    notify: async (request) => {
      const stored = await repository.findWake({ agent: request.agent });
      if (stored === null) return wakers[WakeRung.Inbox].notify(request);
      return wakers[wakeRungFor({ mode: stored.mode })].notify(request);
    },
  };
}
