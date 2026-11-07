import { wakeRungFor, type AgentName, type AgentWaker, type Clock, type WakeRepository } from '@zapbip/core';
import { WakeMode, WakeRung } from '@zapbip/types';

export type WakerByRung = Record<WakeRung, AgentWaker>;

export function createDispatchingAgentWaker(input: { wakers: WakerByRung; repository: WakeRepository; clock: Clock }): AgentWaker {
  const { wakers, repository, clock } = input;

  async function wakerOf(request: { agent: AgentName }): Promise<AgentWaker> {
    const stored = await repository.findWake({ agent: request.agent });
    if (stored === null) return wakers[WakeRung.Inbox];
    const pollState = stored.mode === WakeMode.Scheduled ? await repository.findPollState({ agent: request.agent }) : null;
    const standby =
      stored.mode === WakeMode.Standby && stored.standbyAgent !== null ? await repository.findWake({ agent: stored.standbyAgent }) : null;
    return wakers[wakeRungFor({ wake: stored, pollState, standby, now: clock.now() })];
  }

  return {
    notify: async (request) => (await wakerOf(request)).notify(request),
    hasFailedWake: async (request) => (await wakerOf(request)).hasFailedWake(request),
    pushesEveryMessage: async (request) => (await wakerOf(request)).pushesEveryMessage(request),
  };
}
