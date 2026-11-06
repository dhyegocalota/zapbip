import { D1UsageRepository } from '../adapters/d1/d1-usage-repository';
import type { Bindings } from '../contract/env';
import { runBudgetCheck } from './budget-check';
import { BUDGET_CHECK_CRON, MEDIA_RETENTION_CRON } from './constants';
import { runMediaRetention } from './media-retention';
import { ScheduledJob } from './scheduled-job';

type JobInput = { now: number; env: Bindings };

const JOB_BY_CRON: Record<string, ScheduledJob> = {
  [BUDGET_CHECK_CRON]: ScheduledJob.BudgetCheck,
  [MEDIA_RETENTION_CRON]: ScheduledJob.MediaRetention,
};

const JOB_RUNNERS: Record<ScheduledJob, (input: JobInput) => Promise<void>> = {
  [ScheduledJob.BudgetCheck]: ({ now, env }) => runBudgetCheck({ repository: new D1UsageRepository({ database: env.CONNECTIONS }), now }),
  [ScheduledJob.MediaRetention]: ({ now, env }) => runMediaRetention({ bucket: env.MEDIA, now }),
};

export async function runScheduled(input: { cron: string; now: number; env: Bindings }): Promise<void> {
  const job = JOB_BY_CRON[input.cron];
  if (job === undefined) throw new Error(`unknown cron: ${input.cron}`);
  await JOB_RUNNERS[job]({ now: input.now, env: input.env });
}
