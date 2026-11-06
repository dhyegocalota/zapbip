import type { AgentName } from '../connection';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';

const tails = new WeakMap<object, Promise<unknown>>();

function tailOf(input: { key: object }): Promise<unknown> {
  const tail = tails.get(input.key);
  return tail === undefined ? Promise.resolve() : tail;
}

async function take(input: { dependencies: CoreDependencies; agent: AgentName; limit: number }): Promise<Message[]> {
  const { repository } = input.dependencies;
  const unread = await repository.listUnread({ agent: input.agent, limit: input.limit });
  await repository.markRead({ messageIds: unread.map((message) => message.messageId) });
  return unread.map((message) => ({ ...message, readByAgent: true }));
}

export function takeUnread(input: { dependencies: CoreDependencies; agent: AgentName; limit: number }): Promise<Message[]> {
  const key = input.dependencies.repository;
  const taking = tailOf({ key }).then(() => take(input));
  tails.set(
    key,
    taking.catch(() => undefined),
  );
  return taking;
}
