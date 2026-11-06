import { IdPrefix, InboxCopyKey, MessageKind, type OwnerLocale } from '@zapbip/types';
import { QUESTION_MAX_OPTIONS } from '../constants';
import type { AgentName } from '../connection';
import { renderCopy } from '../inbox-copy';
import type { RoutingList } from '../inbox-records';
import { formatRoutingListQuestionId } from '../option-id';
import type { CoreDependencies } from '../ports';
import { deliverToOwner } from './deliver-to-owner';
import { wakeAgent } from './wake-agent';

export async function listRoutingAgents(input: { dependencies: CoreDependencies }): Promise<AgentName[]> {
  const agents = await input.dependencies.repository.listAgents();
  return [...agents]
    .sort((first, second) => second.lastSeenAt - first.lastSeenAt)
    .slice(0, QUESTION_MAX_OPTIONS)
    .map((record) => record.agent);
}

export async function openRoutingList(input: {
  dependencies: CoreDependencies;
  ownerLocale: OwnerLocale;
  heldMessageId: string;
  agents: AgentName[];
  previous: RoutingList | null;
}): Promise<void> {
  const { dependencies, ownerLocale, heldMessageId, agents, previous } = input;
  const { repository, clock } = dependencies;
  const promptMessageId = dependencies.ids.next({ prefix: IdPrefix.Message });
  const options = agents.map((agent, optionIndex) => ({ optionIndex, title: agent, description: null }));
  const timing = previous === null ? { openedAt: clock.now(), resent: false, reminded: false } : previous;
  await repository.saveRoutingList({
    routingList: { promptMessageId, openedAt: timing.openedAt, locale: ownerLocale, resent: timing.resent, reminded: timing.reminded },
  });
  try {
    await deliverToOwner({
      dependencies,
      ownerLocale,
      agent: null,
      messageId: promptMessageId,
      content: { kind: MessageKind.Choice, questionId: formatRoutingListQuestionId({ messageId: heldMessageId }), options, selected: null },
      replyToMessageId: null,
    });
  } catch (error) {
    if (previous === null) await repository.clearRoutingList();
    if (previous !== null) await repository.saveRoutingList({ routingList: previous });
    throw error;
  }
}

export async function remindOwner(input: {
  dependencies: CoreDependencies;
  ownerLocale: OwnerLocale;
  routingList: RoutingList;
}): Promise<void> {
  const { dependencies, ownerLocale, routingList } = input;
  const text = renderCopy({ key: InboxCopyKey.RoutingListReminder, locale: ownerLocale, values: {} });
  await deliverToOwner({
    dependencies,
    ownerLocale,
    agent: null,
    messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
    content: { kind: MessageKind.Text, text },
    replyToMessageId: routingList.promptMessageId,
  });
  await dependencies.repository.saveRoutingList({ routingList: { ...routingList, reminded: true } });
}

export async function assignHeldMessages(input: {
  dependencies: CoreDependencies;
  ownerLocale: OwnerLocale;
  messageIds: string[];
  agent: AgentName;
  isExpiry: boolean;
}): Promise<void> {
  const { dependencies, ownerLocale, messageIds, agent, isExpiry } = input;
  const { repository } = dependencies;
  const unreadBefore = await repository.countUnread({ agent });
  await repository.assignAgent({ messageIds, agent });
  await repository.clearRoutingList();
  await wakeAgent({ dependencies, ownerLocale, agent, unreadBefore, answeredQuestionId: null, shouldTellOwner: true, isExpiry });
}
