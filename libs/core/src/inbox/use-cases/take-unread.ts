import type { AgentName } from '../connection';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';
import { createSerializer } from './serialize';

const serialize = createSerializer();

async function take(input: { dependencies: CoreDependencies; agent: AgentName; limit: number }): Promise<Message[]> {
  const { repository } = input.dependencies;
  const unread = await repository.listUnread({ agent: input.agent, limit: input.limit });
  await repository.markRead({ messageIds: unread.map((message) => message.messageId) });
  return unread.map((message) => ({ ...message, readByAgent: true }));
}

export function takeUnread(input: { dependencies: CoreDependencies; agent: AgentName; limit: number }): Promise<Message[]> {
  return serialize({ key: input.dependencies.repository, task: () => take(input) });
}
