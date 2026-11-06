import type { DueTimeProvider } from '../contract/due-time-provider';
import type { UsageRepository } from '../operations/usage-repository';
import { listUnflushedUsage, markUsageFlushed } from './usage-ledger';

export function createUsageProvider(input: {
  storage: DurableObjectStorage;
  repository: UsageRepository;
  accountId: string;
}): DueTimeProvider {
  return {
    nextDueAt: async () => {
      const dueTimes = listUnflushedUsage({ storage: input.storage }).map((usage) => usage.dueAt);
      return dueTimes.length === 0 ? null : Math.min(...dueTimes);
    },
    runDue: async ({ now }) => {
      const dueUsages = listUnflushedUsage({ storage: input.storage }).filter((usage) => usage.dueAt <= now);
      await dueUsages.reduce(async (previous, usage) => {
        await previous;
        await input.repository.reportDay({ day: usage.day, accountId: input.accountId, gigabyteSeconds: usage.gigabyteSeconds });
        markUsageFlushed({ storage: input.storage, day: usage.day, gigabyteSeconds: usage.gigabyteSeconds, now });
      }, Promise.resolve());
    },
  };
}
