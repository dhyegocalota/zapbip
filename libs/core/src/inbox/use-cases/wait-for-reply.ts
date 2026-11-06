import { ReplyStatus, WaiterEnd } from '@zapbip/types';
import { HISTORY_LIMIT } from '../constants';
import type { AgentName } from '../connection';
import { notFound } from '../inbox-error-factories';
import type { CoreDependencies } from '../ports';
import { holdForAnswer } from './hold-for-answer';
import { takeUnread } from './take-unread';
import { touchAgent } from './touch-agent';
import type { WaitForReplyInput, WaitForReplyResult } from './types';

async function waitForQuestion(input: {
  dependencies: CoreDependencies;
  agent: AgentName;
  questionId: string;
  timeoutMs: number;
}): Promise<WaitForReplyResult> {
  const { dependencies, agent, questionId, timeoutMs } = input;
  const question = await dependencies.repository.findQuestion({ questionId });
  if (question === null || question.agent !== agent) throw notFound({ message: 'question_id: question not found' });
  const answered = await holdForAnswer({ dependencies, question, timeoutMs });
  if (answered === null) return { status: ReplyStatus.Timeout };
  return answered;
}

async function waitForNextMessage(input: {
  dependencies: CoreDependencies;
  agent: AgentName;
  deadline: number;
}): Promise<WaitForReplyResult> {
  const { dependencies, agent, deadline } = input;
  const messages = await takeUnread({ dependencies, agent, limit: HISTORY_LIMIT });
  if (messages.length > 0) return { status: ReplyStatus.Message, messages };
  const remainingMs = deadline - dependencies.clock.now();
  if (remainingMs <= 0) return { status: ReplyStatus.Timeout };
  const end = await dependencies.waiters.awaitAgentMessage({ agent, timeoutMs: remainingMs });
  if (end === WaiterEnd.Cancelled) return { status: ReplyStatus.Timeout };
  return waitForNextMessage(input);
}

export async function waitForReply(input: WaitForReplyInput): Promise<WaitForReplyResult> {
  const { dependencies, connection, questionId, timeoutMs } = input;
  await touchAgent({ dependencies, agent: connection.agent });
  if (questionId !== null) return waitForQuestion({ dependencies, agent: connection.agent, questionId, timeoutMs });
  return waitForNextMessage({ dependencies, agent: connection.agent, deadline: dependencies.clock.now() + timeoutMs });
}
