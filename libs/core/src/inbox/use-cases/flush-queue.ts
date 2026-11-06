import { DeliveryState } from '@zapbip/types';
import { QUEUE_RETENTION_MS } from '../constants';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';
import { createSerializer } from './serialize';

export function isQueuedMessageExpired(input: { message: Message; now: number }): boolean {
  return input.message.at + QUEUE_RETENTION_MS <= input.now;
}

const serialize = createSerializer();

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
    await sender.session({ message });
  } catch {
    await repository.updateDelivery({ messageId: message.messageId, delivery: DeliveryState.Failed });
    return;
  }
  await repository.updateDelivery({ messageId: message.messageId, delivery: DeliveryState.Sent });
}

async function flushAll(input: { dependencies: CoreDependencies }): Promise<void> {
  const queued = await input.dependencies.repository.listQueued();
  await queued.reduce(
    (previous, message) => previous.then(() => flushMessage({ dependencies: input.dependencies, message })),
    Promise.resolve(),
  );
}

export function flushQueue(input: { dependencies: CoreDependencies }): Promise<void> {
  const { dependencies } = input;
  return serialize({ key: dependencies.repository, task: () => flushAll({ dependencies }) });
}
