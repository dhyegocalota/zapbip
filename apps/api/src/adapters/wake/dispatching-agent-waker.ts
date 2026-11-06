import type { AgentWaker, WakeRepository } from '@zapbip/core';
import type { WakeRung } from '@zapbip/types';

export type WakerByRung = Record<WakeRung.Webhook | WakeRung.Inbox, AgentWaker>;

export function createDispatchingAgentWaker(input: { wakers: WakerByRung; repository: WakeRepository }): AgentWaker {
  void input;
  throw new Error('createDispatchingAgentWaker is not implemented');
}
