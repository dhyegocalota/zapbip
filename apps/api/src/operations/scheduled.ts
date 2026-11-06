import { clearExpiredInstallSecrets, sweepDeletingAccounts } from '../accounts/deletion-sweep';
import type { Bindings } from '../contract/env';

export type ScheduledJob = {
  isDue: (input: { now: number }) => boolean;
  run: (input: { env: Bindings; now: number }) => Promise<void>;
};

enum ScheduledJobName {
  ClearExpiredInstallSecrets = 'clear_expired_install_secrets',
  SweepDeletingAccounts = 'sweep_deleting_accounts',
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
};

export async function runScheduled(input: {
  cron: string;
  now: number;
  env: Bindings;
  jobs?: Record<string, ScheduledJob>;
}): Promise<void> {
  const { now, env, jobs = SCHEDULED_JOBS } = input;
  const dueJobs = Object.values(jobs).filter((job) => job.isDue({ now }));
  const outcomes = await Promise.allSettled(dueJobs.map((job) => job.run({ env, now })));
  const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
  if (failure !== undefined) throw failure.reason;
}
