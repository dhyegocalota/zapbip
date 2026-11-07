import { WakeLogEventName, WakeOutcome } from '@zapbip/types';
import { observeUnsent } from './observe-unsent';
import { nextWakeDueAt } from './wake-due-at';
import type { ScheduleWakeInput } from './wake-ports';
import { isWebhookWake, type WakeJob } from './wake-setting';

export async function scheduleWake(input: ScheduleWakeInput): Promise<WakeOutcome> {
  const { dependencies, wake, agent } = input;
  const { repository, observer } = wake;
  const stored = await repository.findWake({ agent });
  if (!isWebhookWake(stored)) return WakeOutcome.Unreached;
  const now = dependencies.clock.now();
  const job = await repository.findJob({ agent });
  if (job === null) {
    const scheduled: WakeJob = { agent, dueAt: await nextWakeDueAt(input), attempt: 0, leaseUntil: null, rewake: false, lastOutcome: null };
    await repository.saveJob({ job: scheduled });
    observeUnsent({ observer, name: WakeLogEventName.Scheduled, stored, agent, attempt: 0 });
    return WakeOutcome.Woken;
  }
  const isInFlight = job.leaseUntil !== null && job.leaseUntil > now;
  if (isInFlight) await repository.saveJob({ job: { ...job, rewake: true } });
  return WakeOutcome.Woken;
}
