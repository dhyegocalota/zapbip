import { AgentWakeReason, IdPrefix, InboxCopyKey, MessageKind, WakeOutcome } from '@zapbip/types';
import type { AgentName } from '../connection';
import { renderCopy } from '../inbox-copy';
import { formatRoutingListQuestionId } from '../option-id';
import { deliverToOwner } from './deliver-to-owner';
import type { Arrival, ArrivalPlan, OwnerPrompt, Placement, RouteTarget } from './owner-placement';
import type { ReceiveResult } from './types';

async function wakeAgent(
  input: Arrival & { agent: AgentName; unreadBefore: number; answeredQuestionId: string | null; shouldTellOwner: boolean },
): Promise<void> {
  const { dependencies, ownerLocale, agent, unreadBefore, answeredQuestionId, shouldTellOwner } = input;
  const { waiters, waker, ids } = dependencies;
  const hasLiveWaiter = waiters.hasLiveWaiter({ agent, questionId: answeredQuestionId });
  if (answeredQuestionId === null) waiters.resolveAgentMessage({ agent });
  if (answeredQuestionId !== null) waiters.resolveQuestionAnswer({ questionId: answeredQuestionId });
  const isNewBatch = unreadBefore === 0;
  if (hasLiveWaiter || !isNewBatch) return;
  const outcome = await waker.notify({ agent, reason: AgentWakeReason.MessageWaiting });
  if (outcome === WakeOutcome.Woken || !shouldTellOwner) return;
  const text = renderCopy({ key: InboxCopyKey.AgentNotListening, locale: ownerLocale, values: { agent } });
  await deliverToOwner({
    dependencies,
    ownerLocale,
    agent: null,
    messageId: ids.next({ prefix: IdPrefix.Message }),
    content: { kind: MessageKind.Text, text },
    replyToMessageId: null,
  });
}

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
  const { repository } = input.dependencies;
  const { messageIds, agent } = input.target;
  const unreadBefore = await repository.countUnread({ agent });
  await repository.assignAgent({ messageIds, agent });
  await wakeAgent({ ...input, agent, unreadBefore, answeredQuestionId: null, shouldTellOwner: true });
  return { messageId: null, agent, duplicate: false };
}

async function promptOwner(input: Arrival & { heldMessageId: string; prompt: OwnerPrompt }): Promise<void> {
  const { dependencies, ownerLocale, heldMessageId, prompt } = input;
  const baseDelivery = { dependencies, ownerLocale, agent: null, replyToMessageId: null };
  if (prompt.listedAgents.length > 0) {
    const options = prompt.listedAgents.map((agent, optionIndex) => ({ optionIndex, title: agent, description: null }));
    const questionId = formatRoutingListQuestionId({ messageId: heldMessageId });
    await deliverToOwner({
      ...baseDelivery,
      messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
      content: { kind: MessageKind.Choice, questionId, options, selected: null },
    });
  }
  if (prompt.announcesNoAgents) {
    const text = renderCopy({ key: InboxCopyKey.NoAgents, locale: ownerLocale, values: {} });
    await deliverToOwner({
      ...baseDelivery,
      messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
      content: { kind: MessageKind.Text, text },
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
  return wakeAgent({ ...input, agent, unreadBefore, answeredQuestionId, shouldTellOwner });
}

export async function finishArrival(input: Arrival & { plan: ArrivalPlan; messageId: string | null }): Promise<ReceiveResult> {
  const { plan, messageId, ownerMessage } = input;
  const { routeTarget, isStaleRoute, placement, unreadBefore } = plan;
  if (isStaleRoute) return expireRoute(input);
  if (routeTarget !== null) return applyRouteTarget({ ...input, target: routeTarget });
  if (placement === null || messageId === null) return { messageId: null, agent: null, duplicate: false };
  const shouldTellOwner = ownerMessage.content.kind !== MessageKind.Reaction;
  await deliverPlacement({ ...input, placement, messageId, unreadBefore, shouldTellOwner });
  return { messageId, agent: placement.decision.agent, duplicate: false };
}
