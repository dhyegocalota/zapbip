import { MessageDirection } from '@zapbip/types';
import type { AgentName } from '../connection';
import type { CoreDependencies } from '../ports';

export type AcknowledgeDeliveryInput = {
  dependencies: CoreDependencies;
  agent: AgentName;
  messageId: string;
};

export async function acknowledgeDelivery(input: AcknowledgeDeliveryInput): Promise<void> {
  const { repository } = input.dependencies;
  const message = await repository.findMessage({ messageId: input.messageId });
  if (message === null) return;
  const isOwnerMessageOfAgent = message.agent === input.agent && message.direction === MessageDirection.FromOwner;
  if (!isOwnerMessageOfAgent) return;
  await repository.markRead({ messageIds: [message.messageId] });
}
