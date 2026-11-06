import { WaiterEnd } from '@zapbip/types';
import type { AgentName } from './connection';
import type { Clock, ReplyWaiters } from './ports';

type Waiter = { agent: AgentName; questionId: string | null; settle: (end: WaiterEnd) => void };

export function createReplyWaiters(input: { clock: Clock }): ReplyWaiters {
  const waiters = new Set<Waiter>();

  function wait(waitInput: { agent: AgentName; questionId: string | null; timeoutMs: number }): Promise<WaiterEnd> {
    return new Promise((resolve) => {
      const timer = input.clock.schedule({ delayMs: waitInput.timeoutMs, run: () => waiter.settle(WaiterEnd.Resolved) });
      const waiter: Waiter = {
        agent: waitInput.agent,
        questionId: waitInput.questionId,
        settle: (end) => {
          timer.cancel();
          waiters.delete(waiter);
          resolve(end);
        },
      };
      waiters.add(waiter);
    });
  }

  function settleMatching(settling: { matches: (waiter: Waiter) => boolean; end: WaiterEnd }): void {
    [...waiters].filter(settling.matches).forEach((waiter) => waiter.settle(settling.end));
  }

  return {
    awaitQuestionAnswer: ({ agent, questionId, timeoutMs }) => wait({ agent, questionId, timeoutMs }),
    awaitAgentMessage: ({ agent, timeoutMs }) => wait({ agent, questionId: null, timeoutMs }),
    resolveQuestionAnswer: ({ questionId }) =>
      settleMatching({ matches: (waiter) => waiter.questionId === questionId, end: WaiterEnd.Resolved }),
    resolveAgentMessage: ({ agent }) =>
      settleMatching({ matches: (waiter) => waiter.agent === agent && waiter.questionId === null, end: WaiterEnd.Resolved }),
    cancelAgent: ({ agent }) => settleMatching({ matches: (waiter) => waiter.agent === agent, end: WaiterEnd.Cancelled }),
    hasAgentWaiter: ({ agent }) => [...waiters].some((waiter) => waiter.agent === agent),
    hasLiveWaiter: ({ agent, questionId }) => [...waiters].some((waiter) => waiter.agent === agent && waiter.questionId === questionId),
  };
}
