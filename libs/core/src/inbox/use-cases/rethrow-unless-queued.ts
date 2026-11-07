import { DeliveryState } from '@zapbip/types';
import type { CoreDependencies } from '../ports';

export async function rethrowUnlessQueued(input: { dependencies: CoreDependencies; messageId: string; error: unknown }): Promise<void> {
  const message = await input.dependencies.repository.findMessage({ messageId: input.messageId });
  const isQueued = message !== null && message.delivery === DeliveryState.Queued;
  if (!isQueued) throw input.error;
}
