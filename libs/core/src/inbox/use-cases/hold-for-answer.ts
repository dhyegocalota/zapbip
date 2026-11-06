import { ReplyStatus } from '@zapbip/types';
import type { CoreDependencies } from '../ports';
import type { Question } from '../question';
import type { AnsweredReply } from './types';

async function readAnswer(input: { dependencies: CoreDependencies; questionId: string }): Promise<AnsweredReply | null> {
  const { repository } = input.dependencies;
  const question = await repository.findQuestion({ questionId: input.questionId });
  if (question === null || question.answer === null) return null;
  const { answerMessageId, text } = question.answer;
  await repository.markRead({ messageIds: [answerMessageId] });
  return { status: ReplyStatus.Answered, answer: text, messageId: answerMessageId };
}

export async function holdForAnswer(input: {
  dependencies: CoreDependencies;
  question: Question;
  timeoutMs: number;
}): Promise<AnsweredReply | null> {
  const { dependencies, question, timeoutMs } = input;
  const alreadyAnswered = await readAnswer({ dependencies, questionId: question.questionId });
  if (alreadyAnswered !== null) return alreadyAnswered;
  await dependencies.waiters.awaitQuestionAnswer({ agent: question.agent, questionId: question.questionId, timeoutMs });
  return readAnswer({ dependencies, questionId: question.questionId });
}
