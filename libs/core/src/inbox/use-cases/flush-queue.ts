import { DeliveryState } from '@zapbip/types';
import { QUEUE_RETENTION_MS } from '../constants';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';

export function isQueuedMessageExpired(input: { message: Message; now: number }): boolean {
  return input.message.at + QUEUE_RETENTION_MS <= input.now;
}

const claims = new WeakMap<object, Set<string>>();

function claimedIdsOf(input: { key: object }): Set<string> {
  const existing = claims.get(input.key);
  if (existing !== undefined) return existing;
  const created = new Set<string>();
  claims.set(input.key, created);
  return created;
}

async function flushMessage(input: { dependencies: CoreDependencies; message: Message }): Promise<void> {
  const { repository, sender, clock } = input.dependencies;
  const { message } = input;
  const current = await repository.findMessage({ messageId: message.messageId });
  if (current === null || current.delivery !== DeliveryState.Queued) return;
  if (isQueuedMessageExpired({ message, now: clock.now() })) {
    await repository.updateDelivery({ messageId: message.messageId, delivery: DeliveryState.Expired });
    return;
  }
  try {
    await sender.session({ message, question: null, replyToChannelMessageId: null, reactionTargetChannelMessageId: null });
  } catch {
    await repository.updateDelivery({ messageId: message.messageId, delivery: DeliveryState.Failed });
    return;
  }
  await repository.updateDelivery({ messageId: message.messageId, delivery: DeliveryState.Sent });
}

export async function flushQueue(input: { dependencies: CoreDependencies }): Promise<void> {
  const { dependencies } = input;
  const queued = await dependencies.repository.listQueued();
  const claimed = claimedIdsOf({ key: dependencies.repository });
  const mine = queued.filter((message) => !claimed.has(message.messageId));
  mine.forEach((message) => claimed.add(message.messageId));
  try {
    await mine.reduce((previous, message) => previous.then(() => flushMessage({ dependencies, message })), Promise.resolve());
  } finally {
    mine.forEach((message) => claimed.delete(message.messageId));
  }
}
