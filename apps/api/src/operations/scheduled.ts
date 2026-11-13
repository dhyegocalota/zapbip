import { clearExpiredInstallSecrets, sweepDeletingAccounts } from '../accounts/deletion-sweep';
import { pruneClientApp } from '../client-app/prune';
import { pruneBackoffice } from '../backoffice/audit/prune';
import { BACKOFFICE_PRUNE_HOUR, BACKOFFICE_PRUNE_MINUTE } from '../backoffice/backoffice-constants';
import { D1UsageRepository } from '../adapters/d1/d1-usage-repository';
import type { Bindings } from '../contract/env';
import { runBudgetCheck } from './budget-check';
import { BUDGET_CHECK_MINUTE, MEDIA_RETENTION_HOUR, MEDIA_RETENTION_MINUTE, SCHEDULED_CRON } from './constants';
import { runMediaRetention } from './media-retention';

export type ScheduledJob = {
  isDue: (input: { now: number }) => boolean;
  run: (input: { env: Bindings; now: number }) => Promise<void>;
};

export enum ScheduledJobName {
  ClearExpiredInstallSecrets = 'clear_expired_install_secrets',
  SweepDeletingAccounts = 'sweep_deleting_accounts',
  BudgetCheck = 'budget_check',
  MediaRetention = 'media_retention',
  BackofficePrune = 'backoffice_prune',
  ClientAppPrune = 'client_app_prune',
}

const EVERY_TICK = (): boolean => true;

export const SCHEDULED_JOBS: Record<ScheduledJobName, ScheduledJob> = {
  [ScheduledJobName.ClearExpiredInstallSecrets]: {
    isDue: EVERY_TICK,
    run: ({ env, now }) => clearExpiredInstallSecrets({ environment: env, now }),
  },
  [ScheduledJobName.SweepDeletingAccounts]: {
    isDue: EVERY_TICK,
    run: ({ env }) => sweepDeletingAccounts({ environment: env }),
  },
  [ScheduledJobName.BudgetCheck]: {
    isDue: ({ now }) => new Date(now).getUTCMinutes() === BUDGET_CHECK_MINUTE,
    run: ({ env, now }) => runBudgetCheck({ repository: new D1UsageRepository({ database: env.CONNECTIONS }), now }),
  },
  [ScheduledJobName.MediaRetention]: {
    isDue: ({ now }) => {
      const tick = new Date(now);
      return tick.getUTCHours() === MEDIA_RETENTION_HOUR && tick.getUTCMinutes() === MEDIA_RETENTION_MINUTE;
    },
    run: ({ env, now }) => runMediaRetention({ bucket: env.MEDIA, now }),
  },
  [ScheduledJobName.BackofficePrune]: {
    isDue: ({ now }) => {
      const tick = new Date(now);
      return tick.getUTCHours() === BACKOFFICE_PRUNE_HOUR && tick.getUTCMinutes() === BACKOFFICE_PRUNE_MINUTE;
    },
    run: ({ env, now }) => pruneBackoffice({ database: env.CONNECTIONS, now }),
  },
  [ScheduledJobName.ClientAppPrune]: {
    isDue: EVERY_TICK,
    run: ({ env, now }) => pruneClientApp({ database: env.CONNECTIONS, now }),
  },
};

export async function runScheduled(input: {
  cron: string;
  now: number;
  env: Bindings;
  jobs?: Record<string, ScheduledJob>;
}): Promise<void> {
  const { cron, now, env, jobs = SCHEDULED_JOBS } = input;
  if (cron !== SCHEDULED_CRON) throw new Error(`unknown cron: ${cron}`);
  const dueJobs = Object.values(jobs).filter((job) => job.isDue({ now }));
  const outcomes = await Promise.allSettled(dueJobs.map((job) => job.run({ env, now })));
  const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
  if (failure !== undefined) throw failure.reason;
}
