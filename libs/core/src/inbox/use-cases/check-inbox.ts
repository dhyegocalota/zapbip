import { InboxStatus } from '@zapbip/types';
import { HISTORY_LIMIT } from '../constants';
import type { AgentName } from '../connection';
import type { CoreDependencies } from '../ports';
import { takeUnread } from './take-unread';
import { touchAgent } from './touch-agent';
import type { CheckInboxInput, CheckInboxResult } from './types';

export async function readInbox(input: { dependencies: CoreDependencies; agent: AgentName }): Promise<CheckInboxResult> {
  const { dependencies, agent } = input;
  const unreadCount = await dependencies.repository.countUnread({ agent });
  if (unreadCount === 0) return { status: InboxStatus.Empty, messages: [] };
  const messages = await takeUnread({ dependencies, agent, limit: HISTORY_LIMIT });
  if (messages.length === 0) return { status: InboxStatus.Empty, messages };
  return { status: InboxStatus.New, messages };
}

export async function checkInbox(input: CheckInboxInput): Promise<CheckInboxResult> {
  const { dependencies, connection } = input;
  await touchAgent({ dependencies, agent: connection.agent });
  return readInbox({ dependencies, agent: connection.agent });
}
