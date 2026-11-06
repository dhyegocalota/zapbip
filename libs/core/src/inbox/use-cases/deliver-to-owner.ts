import { DeliveryState, MessageDirection, type OwnerLocale } from '@zapbip/types';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';
import { isOwnerWindowOpen } from '../window';
import { closeWindow } from './close-window';
import { noticeOwner } from './notice-owner';
import { attemptSession, deliveryFailureOf, recordFailure, recordSent, SessionOutcome } from './session-delivery';
import type { DeliverToOwnerInput, DeliverToOwnerResult } from './types';

type Delivery = { dependencies: CoreDependencies; ownerLocale: OwnerLocale; message: Message };

async function queueWithNotice(input: Delivery): Promise<DeliverToOwnerResult> {
  const { dependencies, message } = input;
  try {
    await noticeOwner(input);
  } catch (error) {
    await recordFailure({ dependencies, messageId: message.messageId, error });
    throw deliveryFailureOf({ error, kind: message.kind });
  }
  return { delivery: DeliveryState.Queued };
}

async function sendSession(input: Delivery): Promise<DeliverToOwnerResult> {
  const { dependencies, message } = input;
  const attempt = await attemptSession({ dependencies, message });
  if (attempt.outcome === SessionOutcome.Sent) {
    await recordSent({ dependencies, messageId: message.messageId, channelMessageId: attempt.channelMessageId });
    return { delivery: DeliveryState.Sent };
  }
  if (attempt.outcome === SessionOutcome.WindowClosed) {
    await closeWindow({ dependencies, at: dependencies.clock.now() });
    return queueWithNotice(input);
  }
  await recordFailure({ dependencies, messageId: message.messageId, error: attempt.error });
  throw deliveryFailureOf({ error: attempt.error, kind: message.kind });
}

export async function deliverToOwner(input: DeliverToOwnerInput): Promise<DeliverToOwnerResult> {
  const { dependencies, ownerLocale, agent, messageId, content, replyToMessageId } = input;
  const { repository, clock } = dependencies;
  const message: Message = {
    messageId,
    direction: MessageDirection.ToOwner,
    agent,
    at: clock.now(),
    replyToMessageId,
    delivery: DeliveryState.Queued,
    readByAgent: true,
    ...content,
  };
  await repository.insertMessage({ message });
  const window = await repository.findWindow();
  if (isOwnerWindowOpen({ window, now: clock.now() })) return sendSession({ dependencies, ownerLocale, message });
  return queueWithNotice({ dependencies, ownerLocale, message });
}
