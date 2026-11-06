import { IdPrefix, MessageKind } from '@zapbip/types';
import { deliverToOwner } from '../inbox/use-cases/deliver-to-owner';
import { isPollerStale, pollerDeadline } from './poller';
import { staleNoticeCopy } from './wake-copy';
import type { WakeContext } from './wake-ports';
import type { ScheduledWake } from './wake-setting';

export type EvaluatePollersResult = { nextDueAt: number | null };

async function noticeStale(input: WakeContext & { scheduledWake: ScheduledWake; now: number }): Promise<void> {
  const { dependencies, wake, scheduledWake, now } = input;
  const { agent, ownerLocale, hasPolled, lastPolledAt } = scheduledWake;
  if (ownerLocale === null) throw new Error(`scheduled wake of ${agent} has no owner locale`);
  await wake.repository.markStaleNotified({ agent });
  const text = staleNoticeCopy({ locale: ownerLocale, agent, elapsedSinceLastPollMs: hasPolled ? now - lastPolledAt : null });
  await deliverToOwner({
    dependencies,
    ownerLocale,
    agent: null,
    messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
    content: { kind: MessageKind.Text, text },
    replyToMessageId: null,
  });
}

export async function nextPollerDeadline(input: Pick<WakeContext, 'wake'>): Promise<number | null> {
  const scheduledWakes = await input.wake.repository.listScheduledWakes();
  const deadlines = scheduledWakes.map((scheduledWake) => pollerDeadline({ wake: scheduledWake })).filter((deadline) => deadline !== null);
  return deadlines.length === 0 ? null : Math.min(...deadlines);
}

export async function evaluatePollers(input: WakeContext): Promise<EvaluatePollersResult> {
  const { dependencies, wake } = input;
  const now = dependencies.clock.now();
  const scheduledWakes = await wake.repository.listScheduledWakes();
  const staleWakes = scheduledWakes.filter(
    (scheduledWake) => !scheduledWake.pollerStaleNotified && isPollerStale({ wake: scheduledWake, now }),
  );
  await staleWakes.reduce(
    (previous, scheduledWake) => previous.then(() => noticeStale({ ...input, scheduledWake, now })),
    Promise.resolve(),
  );
  return { nextDueAt: await nextPollerDeadline({ wake }) };
}
