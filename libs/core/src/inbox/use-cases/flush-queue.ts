import { DeliveryState, type OwnerLocale } from '@zapbip/types';
import { QUEUE_RETENTION_MS } from '../constants';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';
import { claimQueued } from './claim-queued';
import { closeWindow } from './close-window';
import { noticeOwner, pickNoticeMessage } from './notice-owner';
import { attemptSession, recordFailure, recordSent, SessionOutcome } from './session-delivery';
import { createSerializer } from './serialize';

enum FlushStep {
  Continue = 'continue',
  WindowClosed = 'window_closed',
}

type Flush = { dependencies: CoreDependencies; ownerLocale: OwnerLocale };

export type FlushReport = { failures: Map<string, unknown>; noticeFailure: { error: unknown } | null };

const serialize = createSerializer();

export function isQueuedMessageExpired(input: { message: Message; now: number }): boolean {
  return input.message.at + QUEUE_RETENTION_MS <= input.now;
}

async function flushMessage(input: { dependencies: CoreDependencies; message: Message; report: FlushReport }): Promise<FlushStep> {
  const { dependencies, message, report } = input;
  const { repository, clock } = dependencies;
  if (isQueuedMessageExpired({ message, now: clock.now() })) {
    await repository.updateDelivery({ messageId: message.messageId, delivery: DeliveryState.Expired });
    return FlushStep.Continue;
  }
  const attempt = await attemptSession({ dependencies, message });
  if (attempt.outcome === SessionOutcome.WindowClosed) return FlushStep.WindowClosed;
  if (attempt.outcome === SessionOutcome.Sent) {
    await recordSent({ dependencies, messageId: message.messageId, channelMessageId: attempt.channelMessageId });
    return FlushStep.Continue;
  }
  report.failures.set(message.messageId, attempt.error);
  await recordFailure({ dependencies, messageId: message.messageId, error: attempt.error });
  return FlushStep.Continue;
}

async function stopForClosedWindow(input: Flush & { unsent: Message[]; report: FlushReport }): Promise<void> {
  const { dependencies, ownerLocale, unsent, report } = input;
  const { repository, clock } = dependencies;
  await Promise.all(unsent.map((message) => repository.updateDelivery({ messageId: message.messageId, delivery: DeliveryState.Queued })));
  await closeWindow({ dependencies, at: clock.now() });
  const noticed = pickNoticeMessage({ messages: unsent });
  if (noticed === undefined) return;
  await noticeOwner({ dependencies, ownerLocale, message: noticed }).catch((error: unknown) => {
    report.noticeFailure = { error };
  });
}

async function flushClaimed(input: Flush & { claimed: Message[]; report: FlushReport }): Promise<FlushStep> {
  const [message, ...rest] = input.claimed;
  if (message === undefined) return FlushStep.Continue;
  const step = await flushMessage({ dependencies: input.dependencies, message, report: input.report });
  if (step === FlushStep.WindowClosed) {
    await stopForClosedWindow({ ...input, unsent: input.claimed });
    return step;
  }
  return flushClaimed({ ...input, claimed: rest });
}

async function flushAll(input: Flush & { report: FlushReport }): Promise<FlushReport> {
  const claimed = await claimQueued({ dependencies: input.dependencies });
  if (claimed.length === 0) return input.report;
  const step = await flushClaimed({ ...input, claimed });
  if (step === FlushStep.WindowClosed) return input.report;
  return flushAll(input);
}

export function flushQueue(input: Flush): Promise<FlushReport> {
  const report: FlushReport = { failures: new Map(), noticeFailure: null };
  return serialize({ key: input.dependencies.repository, task: () => flushAll({ ...input, report }) });
}
