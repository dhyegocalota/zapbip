import { wakeRungFor, type AgentWaker, type Clock, type WakeRepository } from '@zapbip/core';
import { WakeMode, WakeRung } from '@zapbip/types';

export type WakerByRung = Record<WakeRung.Webhook | WakeRung.Scheduled | WakeRung.Standby | WakeRung.Inbox, AgentWaker>;

export function createDispatchingAgentWaker(input: { wakers: WakerByRung; repository: WakeRepository; clock: Clock }): AgentWaker {
  const { wakers, repository, clock } = input;
  return {
    notify: async (request) => {
      const stored = await repository.findWake({ agent: request.agent });
      if (stored === null) return wakers[WakeRung.Inbox].notify(request);
      const pollState = await repository.findPollState({ agent: request.agent });
      const standby = stored.mode === WakeMode.Standby && stored.standbyAgent !== null ? await repository.findWake({ agent: stored.standbyAgent }) : null;
      return wakers[wakeRungFor({ wake: stored, pollState, standby, now: clock.now() })].notify(request);
    },
  };
}
