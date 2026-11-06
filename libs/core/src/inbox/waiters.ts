import type { AgentName } from './connection';
import type { Clock, ReplyWaiters } from './ports';

type Waiter = { agent: AgentName; questionId: string | null; settle: () => void };

export function createReplyWaiters(input: { clock: Clock }): ReplyWaiters {
  const waiters = new Set<Waiter>();

  function wait(waitInput: { agent: AgentName; questionId: string | null; timeoutMs: number }): Promise<void> {
    return new Promise((resolve) => {
      const timer = input.clock.schedule({ delayMs: waitInput.timeoutMs, run: () => waiter.settle() });
      const waiter: Waiter = {
        agent: waitInput.agent,
        questionId: waitInput.questionId,
        settle: () => {
          timer.cancel();
          waiters.delete(waiter);
          resolve();
        },
      };
      waiters.add(waiter);
    });
  }

  function settleMatching(matches: (waiter: Waiter) => boolean): void {
    [...waiters].filter(matches).forEach((waiter) => waiter.settle());
  }

  return {
    awaitQuestionAnswer: ({ agent, questionId, timeoutMs }) => wait({ agent, questionId, timeoutMs }),
    awaitAgentMessage: ({ agent, timeoutMs }) => wait({ agent, questionId: null, timeoutMs }),
    resolveQuestionAnswer: ({ questionId }) => settleMatching((waiter) => waiter.questionId === questionId),
    resolveAgentMessage: ({ agent }) => settleMatching((waiter) => waiter.agent === agent && waiter.questionId === null),
    hasLiveWaiter: ({ agent, questionId }) => [...waiters].some((waiter) => waiter.agent === agent && waiter.questionId === questionId),
  };
}
