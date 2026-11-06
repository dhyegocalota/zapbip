import { IdPrefix, MessageKind, WakeLogEventName } from '@zapbip/types';
import { deliverToOwner } from '../inbox/use-cases/deliver-to-owner';
import { observeUnsent } from './observe-unsent';
import { isStaleNoticeDue, pollerDeadline } from './poller';
import { staleNoticeCopy } from './wake-copy';
import type { WakeContext } from './wake-ports';
import type { ScheduledWake } from './wake-setting';

export type EvaluatePollersResult = { nextDueAt: number | null };

type StaleWake = WakeContext & { scheduledWake: ScheduledWake; now: number };

function observeNotice(input: StaleWake & { name: WakeLogEventName }): void {
  const { wake, scheduledWake, name } = input;
  observeUnsent({ observer: wake.observer, name, stored: scheduledWake, agent: scheduledWake.agent, attempt: 0 });
}

async function noticeStale(input: StaleWake): Promise<void> {
  const { dependencies, wake, scheduledWake, now } = input;
  const { agent, ownerLocale, hasPolled, lastPolledAt } = scheduledWake;
  if (ownerLocale === null) {
    await wake.repository.markStaleNotified({ agent, noticedAt: now });
    return observeNotice({ ...input, name: WakeLogEventName.NoticeSkipped });
  }
  const text = staleNoticeCopy({ locale: ownerLocale, agent, elapsedSinceLastPollMs: hasPolled ? now - lastPolledAt : null });
  await deliverToOwner({
    dependencies,
    ownerLocale,
    agent: null,
    messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
    content: { kind: MessageKind.Text, text },
    replyToMessageId: null,
  });
  await wake.repository.markStaleNotified({ agent, noticedAt: now });
}

async function noticeStaleOnce(input: StaleWake): Promise<void> {
  try {
    await noticeStale(input);
  } catch {
    observeNotice({ ...input, name: WakeLogEventName.NoticeFailed });
  }
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
  const staleWakes = scheduledWakes.filter((scheduledWake) => isStaleNoticeDue({ wake: scheduledWake, now }));
  await staleWakes.reduce(
    (previous, scheduledWake) => previous.then(() => noticeStaleOnce({ ...input, scheduledWake, now })),
    Promise.resolve(),
  );
  return { nextDueAt: await nextPollerDeadline({ wake }) };
}
