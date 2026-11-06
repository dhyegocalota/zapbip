import { clearExpiredInstallSecrets, sweepDeletingAccounts } from '../accounts/deletion-sweep';
import type { Bindings } from '../contract/env';

export type ScheduledJob = {
  isDue: (input: { now: number }) => boolean;
  run: (input: { env: Bindings; now: number }) => Promise<void>;
};

export async function runScheduled(input: {
  cron: string;
  now: number;
  env: Bindings;
  jobs?: Record<string, ScheduledJob>;
}): Promise<void> {
  const { now, env } = input;
  const outcomes = await Promise.allSettled([
    clearExpiredInstallSecrets({ environment: env, now }),
    sweepDeletingAccounts({ environment: env }),
  ]);
  const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
  if (failure !== undefined) throw failure.reason;
}
