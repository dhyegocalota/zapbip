import { IdPrefix, InboxCopyKey, MessageKind } from '@zapbip/types';
import type { AgentName } from '../connection';
import { renderCopy } from '../inbox-copy';
import { deliverToOwner } from './deliver-to-owner';
import type { Arrival, ArrivalPlan, OwnerPrompt, Placement, RouteTarget } from './owner-placement';
import { assignHeldMessages, listRoutingAgents, openRoutingList, remindOwner } from './routing-list';
import type { ReceiveResult } from './types';
import { wakeAgent } from './wake-agent';

async function expireRoute(input: Arrival): Promise<ReceiveResult> {
  const { dependencies, ownerLocale } = input;
  const text = renderCopy({ key: InboxCopyKey.RoutingListExpired, locale: ownerLocale, values: {} });
  await deliverToOwner({
    dependencies,
    ownerLocale,
    agent: null,
    messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
    content: { kind: MessageKind.Text, text },
    replyToMessageId: null,
  });
  return { messageId: null, agent: null, duplicate: false };
}

async function applyRouteTarget(input: Arrival & { target: RouteTarget }): Promise<ReceiveResult> {
  const { dependencies, ownerLocale, target } = input;
  await assignHeldMessages({ dependencies, ownerLocale, messageIds: target.messageIds, agent: target.agent, isExpiry: false });
  return { messageId: null, agent: target.agent, duplicate: false };
}

async function resendRoutingList(input: Arrival & { target: RouteTarget }): Promise<ReceiveResult> {
  const { dependencies, ownerLocale, target } = input;
  const [heldMessageId] = target.messageIds;
  if (heldMessageId === undefined) throw new Error('route target holds no message');
  const agents = await listRoutingAgents({ dependencies });
  const previous = await dependencies.repository.findRoutingList();
  await openRoutingList({ dependencies, ownerLocale, heldMessageId, agents, previous });
  return { messageId: null, agent: null, duplicate: false };
}

async function promptOwner(input: Arrival & { heldMessageId: string; prompt: OwnerPrompt }): Promise<void> {
  const { dependencies, ownerLocale, heldMessageId, prompt } = input;
  if (prompt.listedAgents.length > 0)
    await openRoutingList({ dependencies, ownerLocale, heldMessageId, agents: prompt.listedAgents, previous: null });
  if (prompt.reminderFor !== null) await remindOwner({ dependencies, ownerLocale, routingList: prompt.reminderFor });
  if (prompt.announcesNoAgents) {
    const text = renderCopy({ key: InboxCopyKey.NoAgents, locale: ownerLocale, values: {} });
    await deliverToOwner({
      dependencies,
      ownerLocale,
      agent: null,
      messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
      content: { kind: MessageKind.Text, text },
      replyToMessageId: null,
    });
  }
}

async function deliverPlacement(
  input: Arrival & { placement: Placement; messageId: string; unreadBefore: number; shouldTellOwner: boolean },
): Promise<void> {
  const { placement, messageId, unreadBefore, shouldTellOwner } = input;
  const { agent } = placement.decision;
  if (agent === null) return promptOwner({ ...input, heldMessageId: messageId, prompt: placement.prompt });
  const answeredQuestionId = placement.answer === null ? null : placement.answer.questionId;
  const wakeMessageId = answeredQuestionId === null ? messageId : undefined;
  return wakeAgent({ ...input, agent, unreadBefore, answeredQuestionId, shouldTellOwner, isExpiry: false, messageId: wakeMessageId });
}

export async function finishArrival(input: Arrival & { plan: ArrivalPlan; messageId: string | null }): Promise<ReceiveResult> {
  const { plan, messageId, ownerMessage } = input;
  const { routeTarget, isStaleRoute, isUnknownAgentRoute, placement, unreadBefore } = plan;
  if (isStaleRoute) return expireRoute(input);
  if (routeTarget !== null && isUnknownAgentRoute) return resendRoutingList({ ...input, target: routeTarget });
  if (routeTarget !== null) return applyRouteTarget({ ...input, target: routeTarget });
  if (placement === null || messageId === null) return { messageId: null, agent: null, duplicate: false };
  const shouldTellOwner = ownerMessage.content.kind !== MessageKind.Reaction;
  await deliverPlacement({ ...input, placement, messageId, unreadBefore, shouldTellOwner });
  return { messageId, agent: placement.decision.agent, duplicate: false };
}
