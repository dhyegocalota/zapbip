import { D1UsageRepository } from '../adapters/d1/d1-usage-repository';
import type { Bindings } from '../contract/env';
import { runBudgetCheck } from './budget-check';
import { BUDGET_CHECK_MINUTE, MEDIA_RETENTION_HOUR, MEDIA_RETENTION_MINUTE, SCHEDULED_CRON } from './constants';
import { runMediaRetention } from './media-retention';
import { ScheduledJob } from './scheduled-job';

type JobInput = { now: number; env: Bindings };
type JobRecord = { isDue: (tick: Date) => boolean; run: (input: JobInput) => Promise<void> };

const JOBS: Record<ScheduledJob, JobRecord> = {
  [ScheduledJob.BudgetCheck]: {
    isDue: (tick) => tick.getUTCMinutes() === BUDGET_CHECK_MINUTE,
    run: ({ now, env }) => runBudgetCheck({ repository: new D1UsageRepository({ database: env.CONNECTIONS }), now }),
  },
  [ScheduledJob.MediaRetention]: {
    isDue: (tick) => tick.getUTCHours() === MEDIA_RETENTION_HOUR && tick.getUTCMinutes() === MEDIA_RETENTION_MINUTE,
    run: ({ now, env }) => runMediaRetention({ bucket: env.MEDIA, now }),
  },
};

export async function runScheduled(input: { cron: string; now: number; env: Bindings }): Promise<void> {
  if (input.cron !== SCHEDULED_CRON) throw new Error(`unknown cron: ${input.cron}`);
  const tick = new Date(input.now);
  const dueJobs = Object.values(JOBS).filter((job) => job.isDue(tick));
  const outcomes = await Promise.allSettled(dueJobs.map((job) => job.run({ now: input.now, env: input.env })));
  const failure = outcomes.find((outcome) => outcome.status === 'rejected');
  if (failure) throw failure.reason;
}
