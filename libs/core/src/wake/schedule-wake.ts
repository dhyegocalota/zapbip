import { WakeLogEventName, WakeMode, WakeOutcome } from '@zapbip/types';
import { WAKE_DEBOUNCE_MS } from './constants';
import type { ScheduleWakeInput } from './wake-ports';
import type { WakeJob } from './wake-setting';

export async function scheduleWake(input: ScheduleWakeInput): Promise<WakeOutcome> {
  const { dependencies, wake, agent } = input;
  const { repository, observer } = wake;
  const stored = await repository.findWake({ agent });
  if (stored === null || stored.mode !== WakeMode.Webhook || stored.target === null) return WakeOutcome.Unreached;
  const now = dependencies.clock.now();
  const job = await repository.findJob({ agent });
  if (job === null) {
    const scheduled: WakeJob = { agent, dueAt: now + WAKE_DEBOUNCE_MS, attempt: 0, leaseUntil: null, rewake: false, lastOutcome: null };
    await repository.saveJob({ job: scheduled });
    observer.observe({
      event: {
        name: WakeLogEventName.Scheduled,
        provider: stored.target.provider,
        agent,
        attempt: 0,
        statusCode: null,
        latencyMs: null,
        outcome: null,
      },
    });
    return WakeOutcome.Woken;
  }
  const isInFlight = job.leaseUntil !== null && job.leaseUntil > now;
  if (isInFlight) await repository.saveJob({ job: { ...job, rewake: true } });
  return WakeOutcome.Woken;
}
