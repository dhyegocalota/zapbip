import type { AgentWaker, InboxRepository } from '@zapbip/core';

export function createLocalConnectorWaker(input: { context: DurableObjectState; repository: InboxRepository }): AgentWaker {
  void input;
  throw new Error('createLocalConnectorWaker is not implemented');
}
