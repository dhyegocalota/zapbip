import { InboxErrorCode, MessageKind, ReplyStatus, SECOND_MS } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { formatOptionId } from '../option-id';
import { captureInboxError } from '../testing/capture-inbox-error';
import { askAndAbandon, connectionOf, createEnvironment, receive, receiveText, registerAgents, START_AT } from '../testing/fixtures';
import { waitForReply } from './wait-for-reply';

type Environment = Awaited<ReturnType<typeof createEnvironment>>;

function waiting(input: { environment: Environment; agent?: string; questionId: string | null; timeoutMs?: number }) {
  const { environment, agent = 'alpha', questionId, timeoutMs = 5 * SECOND_MS } = input;
  return waitForReply({ dependencies: environment.dependencies, connection: connectionOf({ agent }), questionId, timeoutMs });
}

async function answeredQuestion(input: { environment: Environment }) {
  const question = await askAndAbandon({ environment: input.environment });
  const answer = await receive({
    environment: input.environment,
    content: {
      kind: MessageKind.Choice,
      optionId: formatOptionId({ questionId: question.questionId, optionIndex: 0 }),
      optionTitle: 'Sim',
      optionDescription: null,
    },
  });
  return { question, answerMessageId: answer.messageId };
}

describe('waitForReply with a question', () => {
  test('CU-111 returns an answered question at once and marks the answer read', async () => {
    const environment = await createEnvironment();
    const { question, answerMessageId } = await answeredQuestion({ environment });
    const reply = await waiting({ environment, questionId: question.questionId });
    expect(reply).toEqual({ status: ReplyStatus.Answered, answer: 'Sim', messageId: answerMessageId, optionIndex: 0 });
    expect(await environment.repository.findMessage({ messageId: answerMessageId! })).toMatchObject({ readByAgent: true });
  });

  test('CU-112 the answer stays bound to its question', async () => {
    const environment = await createEnvironment();
    const { question } = await answeredQuestion({ environment });
    const replies = [
      await waiting({ environment, questionId: question.questionId }),
      await waiting({ environment, questionId: question.questionId }),
      await waiting({ environment, questionId: question.questionId }),
    ];
    expect(new Set(replies.map((reply) => JSON.stringify(reply))).size).toBe(1);
  });

  test('CU-113 another agent cannot read the question', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment });
    const error = await captureInboxError(() => waiting({ environment, agent: 'beta', questionId: question.questionId }));
    expect(error).toEqual({ code: InboxErrorCode.NotFound, message: 'question_id: question not found' });
  });

  test('CU-114 an unknown question', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() => waiting({ environment, questionId: 'qst_missing' }));
    expect(error).toEqual({ code: InboxErrorCode.NotFound, message: 'question_id: question not found' });
  });

  test('holds for the answer and returns it when it lands', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment });
    const holding = waiting({ environment, questionId: question.questionId });
    await environment.clock.advance({ ms: SECOND_MS });
    const answer = await receiveText({ environment, text: 'sim' });
    expect(await holding).toEqual({ status: ReplyStatus.Answered, answer: 'sim', messageId: answer.messageId, optionIndex: null });
  });

  test('times out when the question stays open', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment });
    const holding = waiting({ environment, questionId: question.questionId, timeoutMs: SECOND_MS });
    await environment.clock.advance({ ms: SECOND_MS });
    expect(await holding).toEqual({ status: ReplyStatus.Timeout });
  });
});

describe('waitForReply without a question', () => {
  test('CU-115 returns the unread messages at once and marks them read', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    await receiveText({ environment, text: '@alpha one' });
    await receiveText({ environment, text: '@alpha two' });
    const reply = await waiting({ environment, questionId: null });
    expect(reply).toMatchObject({
      status: ReplyStatus.Message,
      messages: [
        { text: 'one', readByAgent: true },
        { text: 'two', readByAgent: true },
      ],
    });
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(0);
  });

  test('CU-116 waits for the next owner message', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    const holding = waiting({ environment, questionId: null });
    await environment.clock.advance({ ms: 500 });
    await receiveText({ environment, text: '@alpha hi' });
    expect(await holding).toMatchObject({ status: ReplyStatus.Message, messages: [{ text: 'hi' }] });
    expect(environment.clock.now()).toBe(START_AT + 500);
  });

  test('CU-117 times out at the deadline', async () => {
    const environment = await createEnvironment();
    const holding = waiting({ environment, questionId: null, timeoutMs: SECOND_MS });
    await environment.clock.advance({ ms: SECOND_MS });
    expect(await holding).toEqual({ status: ReplyStatus.Timeout });
  });

  test('CU-118 two concurrent calls share one message', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    const first = waiting({ environment, questionId: null, timeoutMs: 2 * SECOND_MS });
    const second = waiting({ environment, questionId: null, timeoutMs: 2 * SECOND_MS });
    await environment.clock.advance({ ms: 0 });
    await receiveText({ environment, text: '@alpha hi' });
    await environment.clock.advance({ ms: 2 * SECOND_MS });
    const statuses = (await Promise.all([first, second])).map((reply) => reply.status).sort();
    expect(statuses).toEqual([ReplyStatus.Message, ReplyStatus.Timeout]);
  });
});

describe('waitForReply cancelled by a revocation', () => {
  test('a held wait for the next message ends at once with a timeout and delivers nothing after', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    const holding = waiting({ environment, questionId: null, timeoutMs: 5 * SECOND_MS });
    await environment.clock.advance({ ms: 0 });
    const cancelledAt = environment.clock.now();
    environment.dependencies.waiters.cancelAgent({ agent: 'alpha' });
    expect(await holding).toEqual({ status: ReplyStatus.Timeout });
    expect(environment.clock.now()).toBe(cancelledAt);
    expect(environment.dependencies.waiters.hasAgentWaiter({ agent: 'alpha' })).toBe(false);
    await receiveText({ environment, text: '@alpha hi' });
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(1);
  });

  test('a held wait for a question ends at once with a timeout', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment });
    const holding = waiting({ environment, questionId: question.questionId, timeoutMs: 5 * SECOND_MS });
    await environment.clock.advance({ ms: 0 });
    const cancelledAt = environment.clock.now();
    environment.dependencies.waiters.cancelAgent({ agent: 'alpha' });
    expect(await holding).toEqual({ status: ReplyStatus.Timeout });
    expect(environment.clock.now()).toBe(cancelledAt);
  });
});
