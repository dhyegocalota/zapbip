import { DeliveryState } from '@zapbip/types';
import { QUEUE_RETENTION_MS } from '../constants';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';

export function isQueuedMessageExpired(input: { message: Message; now: number }): boolean {
  return input.message.at + QUEUE_RETENTION_MS <= input.now;
}

async function flushMessage(input: { dependencies: CoreDependencies; message: Message }): Promise<void> {
  const { repository, sender, clock } = input.dependencies;
  const { message } = input;
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

export async function flushQueue(input: { dependencies: CoreDependencies }): Promise<void> {
  const queued = await input.dependencies.repository.listQueued();
  await queued.reduce(
    (previous, message) => previous.then(() => flushMessage({ dependencies: input.dependencies, message })),
    Promise.resolve(),
  );
}
