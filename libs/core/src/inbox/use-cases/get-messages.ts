import { HISTORY_LIMIT } from '../constants';
import { invalidInput } from '../inbox-error-factories';
import { takeUnread } from './take-unread';
import { touchAgent } from './touch-agent';
import type { GetMessagesInput, GetMessagesResult } from './types';

const LIMIT_MIN = 1;

export async function getMessages(input: GetMessagesInput): Promise<GetMessagesResult> {
  const { dependencies, connection, limit } = input;
  const isValidLimit = Number.isInteger(limit) && limit >= LIMIT_MIN && limit <= HISTORY_LIMIT;
  if (!isValidLimit) throw invalidInput({ message: `limit: must be between ${LIMIT_MIN} and ${HISTORY_LIMIT}` });
  await touchAgent({ dependencies, agent: connection.agent });
  const unread = await takeUnread({ dependencies, agent: connection.agent, limit });
  const history = await dependencies.repository.listAgentHistory({ agent: connection.agent, limit });
  return { unread, history };
}
