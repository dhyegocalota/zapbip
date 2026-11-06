import type { AgentName } from '../connection';
import type { CoreDependencies } from '../ports';

export type AcknowledgeDeliveryInput = {
  dependencies: CoreDependencies;
  agent: AgentName;
  messageId: string;
};

export async function acknowledgeDelivery(input: AcknowledgeDeliveryInput): Promise<void> {
  void input;
  throw new Error('acknowledgeDelivery is not implemented');
}
