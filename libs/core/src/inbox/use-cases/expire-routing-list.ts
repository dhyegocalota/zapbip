import { ROUTING_LIST_TTL_MS, WINDOW_MS } from '../constants';
import type { CoreDependencies } from '../ports';
import { assignHeldMessages, listRoutingAgents, openRoutingList } from './routing-list';

export async function findRoutingListDueAt(input: { dependencies: CoreDependencies }): Promise<number | null> {
  const routingList = await input.dependencies.repository.findRoutingList();
  return routingList === null ? null : routingList.openedAt + ROUTING_LIST_TTL_MS;
}

export async function expireRoutingList(input: { dependencies: CoreDependencies }): Promise<void> {
  const { dependencies } = input;
  const { repository, clock } = dependencies;
  const now = clock.now();
  const routingList = await repository.findRoutingList();
  if (routingList === null || now < routingList.openedAt + ROUTING_LIST_TTL_MS) return;
  const { locale: ownerLocale } = routingList;
  const isClaimed = await repository.claimRoutingListExpiry({ openedAt: routingList.openedAt, claimedAt: now });
  if (!isClaimed) return;
  const claimedList = { ...routingList, openedAt: now, resent: true };
  const [held, recentAgent, agents] = await Promise.all([
    repository.listHeld(),
    repository.findLastAgentWrite({ since: now - WINDOW_MS }),
    listRoutingAgents({ dependencies }),
  ]);
  const [firstHeld] = held;
  if (firstHeld === undefined) return repository.clearRoutingList();
  const messageIds = held.map((message) => message.messageId);
  if (recentAgent !== null) return assignHeldMessages({ dependencies, ownerLocale, messageIds, agent: recentAgent, isExpiry: true });
  if (!routingList.resent)
    return openRoutingList({ dependencies, ownerLocale, heldMessageId: firstHeld.messageId, agents, previous: claimedList });
  const [lastSeenAgent] = agents;
  if (lastSeenAgent === undefined) return repository.clearRoutingList();
  return assignHeldMessages({ dependencies, ownerLocale, messageIds, agent: lastSeenAgent, isExpiry: true });
}
