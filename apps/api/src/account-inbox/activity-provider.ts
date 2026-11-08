import type { DueTimeProvider } from '../contract/due-time-provider';
import type { ActivityRepository } from '../operations/activity-repository';
import { listUnflushedActivity, markActivityFlushed, pruneActivity } from './activity-ledger';
import { USAGE_METER_RETENTION_MS, utcDay } from './usage-meter';

export function createActivityProvider(input: {
  storage: DurableObjectStorage;
  repository: ActivityRepository;
  accountId: string;
}): DueTimeProvider {
  return {
    nextDueAt: async () => {
      const dueTimes = listUnflushedActivity({ storage: input.storage }).map((activity) => activity.dueAt);
      return dueTimes.length === 0 ? null : Math.min(...dueTimes);
    },
    runDue: async ({ now }) => {
      const dueActivities = listUnflushedActivity({ storage: input.storage }).filter((activity) => activity.dueAt <= now);
      const hasDueActivities = dueActivities.length > 0;
      if (hasDueActivities) await input.repository.reportActivity({ accountId: input.accountId, entries: dueActivities });
      dueActivities.forEach((activity) => markActivityFlushed({ storage: input.storage, activity, now }));
      pruneActivity({ storage: input.storage, beforeDay: utcDay({ now: now - USAGE_METER_RETENTION_MS }) });
    },
  };
}
