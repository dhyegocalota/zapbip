import { InboxStatus } from '@zapbip/types';
import { HISTORY_LIMIT } from '../constants';
import { takeUnread } from './take-unread';
import { touchAgent } from './touch-agent';
import type { CheckInboxInput, CheckInboxResult } from './types';

export async function checkInbox(input: CheckInboxInput): Promise<CheckInboxResult> {
  const { dependencies, connection } = input;
  await touchAgent({ dependencies, agent: connection.agent });
  const messages = await takeUnread({ dependencies, agent: connection.agent, limit: HISTORY_LIMIT });
  if (messages.length === 0) return { status: InboxStatus.Empty, messages };
  return { status: InboxStatus.New, messages };
}
