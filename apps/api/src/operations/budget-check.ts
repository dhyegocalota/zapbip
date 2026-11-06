import type { UsageRepository } from './usage-repository';

export function runBudgetCheck(input: { repository: UsageRepository; now: number }): Promise<void> {
  void input;
  throw new Error('runBudgetCheck is not implemented');
}
