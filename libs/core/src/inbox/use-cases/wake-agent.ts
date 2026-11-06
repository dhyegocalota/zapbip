import { AgentWakeReason, IdPrefix, InboxCopyKey, MessageKind, WakeOutcome, type OwnerLocale } from '@zapbip/types';
import type { AgentName } from '../connection';
import { renderCopy } from '../inbox-copy';
import type { CoreDependencies } from '../ports';
import { deliverToOwner } from './deliver-to-owner';

export async function wakeAgent(input: {
  dependencies: CoreDependencies;
  ownerLocale: OwnerLocale;
  agent: AgentName;
  unreadBefore: number;
  answeredQuestionId: string | null;
  shouldTellOwner: boolean;
}): Promise<void> {
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
