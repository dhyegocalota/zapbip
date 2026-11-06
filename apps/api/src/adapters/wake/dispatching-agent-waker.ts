import type { AgentWaker, Clock, WakeRepository } from '@zapbip/core';
import type { WakeRung } from '@zapbip/types';

export type WakerByRung = Record<WakeRung.Webhook | WakeRung.Scheduled | WakeRung.Standby | WakeRung.Inbox, AgentWaker>;

export function createDispatchingAgentWaker(input: { wakers: WakerByRung; repository: WakeRepository; clock: Clock }): AgentWaker {
  void input;
  throw new Error('createDispatchingAgentWaker is not implemented');
}
