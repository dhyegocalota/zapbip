import { DeliveryState, IdPrefix, MessageKind, ReplyStatus } from '@zapbip/types';
import { ASK_RETRY_WINDOW_MS, QUESTION_MAX_CHARS } from '../constants';
import { invalidInput } from '../inbox-error-factories';
import type { QuestionOption } from '../message';
import type { Question } from '../question';
import { buildQuestionKey } from '../question-key';
import { assertMaxChars, parseOptionDescriptions, parseOptions } from '../validation';
import { deliverToOwner } from './deliver-to-owner';
import { holdForAnswer } from './hold-for-answer';
import { touchAgent } from './touch-agent';
import type { AskInput, AskResult, CallContext } from './types';

function buildOptions(input: { titles: string[]; descriptions: (string | null)[] }): QuestionOption[] {
  const { titles, descriptions } = input;
  const hasDescriptions = descriptions.length > 0;
  if (hasDescriptions && descriptions.length !== titles.length) throw invalidInput({ message: 'option_descriptions: must match options' });
  const parsed = parseOptionDescriptions({ descriptions: hasDescriptions ? descriptions : titles.map(() => null) });
  return titles.map((title, optionIndex) => ({ optionIndex, title, description: parsed[optionIndex]! }));
}

async function isPromptDelivered(input: CallContext & { question: Question }): Promise<boolean> {
  const prompt = await input.dependencies.repository.findMessage({ messageId: input.question.promptMessageId });
  return prompt !== null && prompt.delivery !== DeliveryState.Failed;
}

async function createQuestion(input: CallContext & { text: string; options: QuestionOption[]; normalizedKey: string }): Promise<Question> {
  const { dependencies, connection, text, options, normalizedKey } = input;
  const question: Question = {
    questionId: dependencies.ids.next({ prefix: IdPrefix.Question }),
    agent: connection.agent,
    text,
    options,
    normalizedKey,
    promptMessageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
    askedAt: dependencies.clock.now(),
    answer: null,
  };
  await dependencies.repository.insertQuestion({ question });
  await deliverToOwner({
    dependencies,
    ownerLocale: connection.ownerLocale,
    agent: connection.agent,
    messageId: question.promptMessageId,
    content: { kind: MessageKind.Choice, questionId: question.questionId, options, selected: null },
    replyToMessageId: null,
  });
  return question;
}

export async function ask(input: AskInput): Promise<AskResult> {
  const { dependencies, connection, text, timeoutMs } = input;
  await touchAgent({ dependencies, agent: connection.agent });
  assertMaxChars({ field: 'question', value: text, maxChars: QUESTION_MAX_CHARS });
  const { titles } = parseOptions({ options: input.options });
  const options = buildOptions({ titles, descriptions: input.optionDescriptions });
  const normalizedKey = buildQuestionKey({ agent: connection.agent, text, optionTitles: titles });
  const recent = await dependencies.repository.findRecentQuestion({
    agent: connection.agent,
    normalizedKey,
    askedAfter: dependencies.clock.now() - ASK_RETRY_WINDOW_MS,
  });
  const isRetry = recent !== null && (await isPromptDelivered({ dependencies, connection, question: recent }));
  const question = isRetry ? recent : await createQuestion({ dependencies, connection, text, options, normalizedKey });
  const answered = await holdForAnswer({ dependencies, question, timeoutMs });
  if (answered === null) return { status: ReplyStatus.Pending, questionId: question.questionId };
  return answered;
}
