import type { AgentWaker, InboxRepository } from '@zapbip/core';
import { CONNECTOR_INBOX_LIMIT, ConnectorFrameType, WakeOutcome } from '@zapbip/types';
import { sendFrameToAgent } from '../../account-inbox/connector-sockets';

export function createLocalConnectorWaker(input: { context: DurableObjectState; repository: InboxRepository }): AgentWaker {
  const { context, repository } = input;
  return {
    notify: async ({ agent }) => {
      const messages = await repository.listUnread({ agent, limit: CONNECTOR_INBOX_LIMIT });
      if (messages.length === 0) return WakeOutcome.Unreached;
      const socketCount = sendFrameToAgent({ context, agent, frame: { type: ConnectorFrameType.Messages, messages } });
      return socketCount > 0 ? WakeOutcome.Woken : WakeOutcome.Unreached;
    },
  };
}
