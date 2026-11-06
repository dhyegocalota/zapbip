import type { AgentWaker, InboxRepository } from '@zapbip/core';
import { CONNECTOR_INBOX_LIMIT, WakeOutcome } from '@zapbip/types';
import { sendMessagesToAgent } from '../../account-inbox/connector-sockets';

export function createLocalConnectorWaker(input: { context: DurableObjectState; repository: InboxRepository }): AgentWaker {
  const { context, repository } = input;
  return {
    notify: async ({ agent }) => {
      const messages = await repository.listUnread({ agent, limit: CONNECTOR_INBOX_LIMIT });
      if (messages.length === 0) return WakeOutcome.Unreached;
      const { socketCount, oversizedCount } = sendMessagesToAgent({ context, agent, messages });
      const isFullyDelivered = socketCount > 0 && oversizedCount === 0;
      return isFullyDelivered ? WakeOutcome.Woken : WakeOutcome.Unreached;
    },
  };
}
