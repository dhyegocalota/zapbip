import type { WakeContext } from './wake-ports';

export type EvaluatePollersResult = { nextDueAt: number | null };

export function evaluatePollers(input: WakeContext): Promise<EvaluatePollersResult> {
  void input;
  throw new Error('evaluatePollers is not implemented');
}

export function nextPollerDeadline(input: Pick<WakeContext, 'wake'>): Promise<number | null> {
  void input;
  throw new Error('nextPollerDeadline is not implemented');
}
