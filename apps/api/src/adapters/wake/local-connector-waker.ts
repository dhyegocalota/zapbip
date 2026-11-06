import type { AgentWaker, InboxRepository } from '@zapbip/core';
import { CONNECTOR_INBOX_LIMIT, WakeOutcome } from '@zapbip/types';
import { hasLiveConnectorSocket, sendMessagesToAgent } from '../../account-inbox/connector-sockets';

export function createLocalConnectorWaker(input: {
  context: DurableObjectState;
  repository: InboxRepository;
  restoreAndNotify: AgentWaker['notify'];
}): AgentWaker {
  const { context, repository, restoreAndNotify } = input;
  return {
    notify: async (request) => {
      const { agent } = request;
      const messages = await repository.listUnread({ agent, limit: CONNECTOR_INBOX_LIMIT });
      if (messages.length === 0) return WakeOutcome.Unreached;
      if (!hasLiveConnectorSocket({ context, agent })) return restoreAndNotify(request);
      const { socketCount, oversizedCount } = sendMessagesToAgent({ context, agent, messages });
      const isFullyDelivered = socketCount > 0 && oversizedCount === 0;
      return isFullyDelivered ? WakeOutcome.Woken : WakeOutcome.Unreached;
    },
    hasFailedWake: async () => false,
    pushesEveryMessage: async ({ agent }) => hasLiveConnectorSocket({ context, agent }),
  };
}
