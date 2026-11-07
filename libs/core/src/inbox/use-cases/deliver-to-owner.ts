import { DeliveryState, MessageDirection, type OwnerLocale } from '@zapbip/types';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';
import { isOwnerWindowOpen } from '../window';
import { noticeOwner } from './notice-owner';
import { flushQueue } from './flush-queue';
import { deliveryFailureOf, recordFailure } from './session-delivery';
import type { DeliverToOwnerInput, DeliverToOwnerResult } from './types';

type Delivery = { dependencies: CoreDependencies; ownerLocale: OwnerLocale; message: Message };

async function queueWithNotice(input: Delivery): Promise<DeliverToOwnerResult> {
  await noticeOwner(input);
  return { delivery: DeliveryState.Queued };
}

async function sendSession(input: Delivery): Promise<DeliverToOwnerResult> {
  const { dependencies, ownerLocale, message } = input;
  const { messageId, kind } = message;
  const report = await flushQueue({ dependencies, ownerLocale });
  const current = await dependencies.repository.findMessage({ messageId });
  const delivery = current === null ? null : current.delivery;
  if (delivery === DeliveryState.Sent) return { delivery };
  const { noticeFailure } = report;
  const isQueuedWithFailedNotice = delivery === DeliveryState.Queued && noticeFailure !== null;
  if (isQueuedWithFailedNotice) throw noticeFailure.error;
  if (delivery === DeliveryState.Queued) return { delivery };
  const error = report.failures.get(messageId);
  await recordFailure({ dependencies, messageId, error });
  throw deliveryFailureOf({ error, kind });
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
    forwarded: false,
    handedTo: null,
    originMessageId: null,
    ...content,
  };
  await repository.insertMessage({ message });
  const window = await repository.findWindow();
  if (isOwnerWindowOpen({ window, now: clock.now() })) return sendSession({ dependencies, ownerLocale, message });
  return queueWithNotice({ dependencies, ownerLocale, message });
}
