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
  resent: boolean;
}): Promise<void> {
  const { dependencies, ownerLocale, heldMessageId, agents, resent } = input;
  const promptMessageId = dependencies.ids.next({ prefix: IdPrefix.Message });
  const options = agents.map((agent, optionIndex) => ({ optionIndex, title: agent, description: null }));
  await deliverToOwner({
    dependencies,
    ownerLocale,
    agent: null,
    messageId: promptMessageId,
    content: { kind: MessageKind.Choice, questionId: formatRoutingListQuestionId({ messageId: heldMessageId }), options, selected: null },
    replyToMessageId: null,
  });
  await dependencies.repository.saveRoutingList({
    routingList: { promptMessageId, openedAt: dependencies.clock.now(), locale: ownerLocale, resent, reminded: false },
  });
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
}): Promise<void> {
  const { dependencies, ownerLocale, messageIds, agent } = input;
  const { repository } = dependencies;
  const unreadBefore = await repository.countUnread({ agent });
  await repository.assignAgent({ messageIds, agent });
  await repository.clearRoutingList();
  await wakeAgent({ dependencies, ownerLocale, agent, unreadBefore, answeredQuestionId: null, shouldTellOwner: true });
}
