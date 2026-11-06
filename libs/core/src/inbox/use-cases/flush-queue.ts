import { DeliveryState, type OwnerLocale } from '@zapbip/types';
import { QUEUE_RETENTION_MS } from '../constants';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';
import { claimQueued } from './claim-queued';
import { closeWindow } from './close-window';
import { noticeOwner } from './notice-owner';
import { attemptSession, recordFailure, recordSent, SessionOutcome } from './session-delivery';

enum FlushStep {
  Continue = 'continue',
  WindowClosed = 'window_closed',
}

type Flush = { dependencies: CoreDependencies; ownerLocale: OwnerLocale };

export function isQueuedMessageExpired(input: { message: Message; now: number }): boolean {
  return input.message.at + QUEUE_RETENTION_MS <= input.now;
}

async function flushMessage(input: { dependencies: CoreDependencies; message: Message }): Promise<FlushStep> {
  const { dependencies, message } = input;
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
  await recordFailure({ dependencies, messageId: message.messageId, error: attempt.error });
  return FlushStep.Continue;
}

async function stopForClosedWindow(input: Flush & { unsent: Message[] }): Promise<void> {
  const { dependencies, ownerLocale, unsent } = input;
  const { repository, clock } = dependencies;
  await Promise.all(unsent.map((message) => repository.updateDelivery({ messageId: message.messageId, delivery: DeliveryState.Queued })));
  await closeWindow({ dependencies, at: clock.now() });
  const noticed = unsent.find((message) => message.agent !== null);
  if (noticed === undefined) return;
  await noticeOwner({ dependencies, ownerLocale, message: noticed }).catch(() => undefined);
}

async function flushClaimed(input: Flush & { claimed: Message[] }): Promise<FlushStep> {
  const [message, ...rest] = input.claimed;
  if (message === undefined) return FlushStep.Continue;
  const step = await flushMessage({ dependencies: input.dependencies, message });
  if (step === FlushStep.WindowClosed) {
    await stopForClosedWindow({ ...input, unsent: input.claimed });
    return step;
  }
  return flushClaimed({ ...input, claimed: rest });
}

export async function flushQueue(input: Flush): Promise<void> {
  const claimed = await claimQueued({ dependencies: input.dependencies });
  if (claimed.length === 0) return;
  const step = await flushClaimed({ ...input, claimed });
  if (step === FlushStep.WindowClosed) return;
  await flushQueue(input);
}
