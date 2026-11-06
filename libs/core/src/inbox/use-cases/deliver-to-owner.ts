import { ChannelErrorKind, DeliveryState, MessageDirection, type MessageKind } from '@zapbip/types';
import { InboxError } from '../errors';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';
import { isOwnerWindowOpen } from '../window';
import { flushQueue } from './flush-queue';
import { sendNotice } from './send-notice';
import type { DeliverToOwnerInput, DeliverToOwnerResult } from './types';

function deliveryFailure(input: { kind: MessageKind }): InboxError {
  return new InboxError({ code: ChannelErrorKind.DeliveryFailed, message: `delivery failed for ${input.kind}` });
}

async function sendSession(input: { dependencies: CoreDependencies; message: Message }): Promise<DeliverToOwnerResult> {
  const { dependencies, message } = input;
  await flushQueue({ dependencies });
  const current = await dependencies.repository.findMessage({ messageId: message.messageId });
  const isSent = current !== null && current.delivery === DeliveryState.Sent;
  if (!isSent) throw deliveryFailure({ kind: message.kind });
  return { delivery: DeliveryState.Sent };
}

async function queueWithNotice(input: DeliverToOwnerInput): Promise<DeliverToOwnerResult> {
  const { dependencies, ownerLocale, agent, content } = input;
  const queued = { delivery: DeliveryState.Queued } as const;
  if (agent === null) return queued;
  await sendNotice({ dependencies, ownerLocale, agent, content });
  return queued;
}

export async function deliverToOwner(input: DeliverToOwnerInput): Promise<DeliverToOwnerResult> {
  const { dependencies, agent, messageId, content, replyToMessageId } = input;
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
  if (isOwnerWindowOpen({ window, now: clock.now() })) return sendSession({ dependencies, message });
  return queueWithNotice(input);
}
