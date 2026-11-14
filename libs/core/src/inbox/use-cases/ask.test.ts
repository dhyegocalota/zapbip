import { ChannelErrorKind, DeliveryState, InboxErrorCode, MessageKind, ReplyStatus, SECOND_MS, TemplateKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { ASK_MAX_WAIT_MS, ASK_RETRY_WINDOW_MS, WINDOW_MS } from '../constants';
import { formatOptionId } from '../option-id';
import { captureInboxError } from '../testing/capture-inbox-error';
import { closeWindow, connectionOf, createEnvironment, receive, receiveText } from '../testing/fixtures';
import { ask } from './ask';
import type { AskInput } from './types';

type Environment = Awaited<ReturnType<typeof createEnvironment>>;

function asking(input: { environment: Environment } & Partial<Omit<AskInput, 'dependencies'>>) {
  const { environment, ...overrides } = input;
  return ask({
    dependencies: environment.dependencies,
    connection: connectionOf({ agent: 'alpha' }),
    text: 'Deploy?',
    options: ['Sim', 'Não'],
    optionDescriptions: [],
    timeoutMs: ASK_MAX_WAIT_MS,
    ...overrides,
  });
}

async function openQuestionId(input: { environment: Environment }): Promise<string> {
  const [question] = await input.environment.repository.listOpenQuestions();
  if (question === undefined) throw new Error('expected an open question');
  return question.questionId;
}

function tap(input: { environment: Environment; questionId: string; optionIndex: number; optionTitle: string }) {
  const { environment, questionId, optionIndex, optionTitle } = input;
  return receive({
    environment,
    content: { kind: MessageKind.Choice, optionId: formatOptionId({ questionId, optionIndex }), optionTitle, optionDescription: null },
  });
}

describe('ask', () => {
  test('CU-102 returns the answer when the owner taps while the call is held', async () => {
    const environment = await createEnvironment();
    const waiting = asking({ environment });
    await environment.clock.advance({ ms: 0 });
    const questionId = await openQuestionId({ environment });
    const answer = await tap({ environment, questionId, optionIndex: 0, optionTitle: 'Sim' });
    expect(await waiting).toEqual({ status: ReplyStatus.Answered, answer: 'Sim', messageId: answer.messageId, optionIndex: 0 });
  });

  test('an owner text answers the open question', async () => {
    const environment = await createEnvironment();
    const waiting = asking({ environment });
    await environment.clock.advance({ ms: 0 });
    const answer = await receiveText({ environment, text: 'talvez' });
    expect(await waiting).toEqual({ status: ReplyStatus.Answered, answer: 'talvez', messageId: answer.messageId, optionIndex: null });
  });

  test('CU-103 a retry after the answer returns the answer and sends nothing', async () => {
    const environment = await createEnvironment();
    const waiting = asking({ environment });
    await environment.clock.advance({ ms: 0 });
    const answer = await tap({ environment, questionId: await openQuestionId({ environment }), optionIndex: 0, optionTitle: 'Sim' });
    await waiting;
    const retry = await asking({ environment });
    expect(retry).toEqual({ status: ReplyStatus.Answered, answer: 'Sim', messageId: answer.messageId, optionIndex: 0 });
    expect(environment.sender.sessions).toHaveLength(1);
  });

  test('CU-104 an open retry sends nothing new and holds on the same question', async () => {
    const environment = await createEnvironment();
    const first = asking({ environment, timeoutMs: 5 * SECOND_MS });
    await environment.clock.advance({ ms: 0 });
    const second = asking({ environment, timeoutMs: SECOND_MS });
    await environment.clock.advance({ ms: SECOND_MS });
    const questionId = await openQuestionId({ environment });
    expect(await second).toEqual({ status: ReplyStatus.Pending, questionId });
    expect(environment.sender.sessions).toHaveLength(1);
    await environment.clock.advance({ ms: 4 * SECOND_MS });
    expect(await first).toEqual({ status: ReplyStatus.Pending, questionId });
  });

  test('CU-105 a retry after the retry window is a new question', async () => {
    const environment = await createEnvironment();
    const waiting = asking({ environment });
    await environment.clock.advance({ ms: 0 });
    const firstQuestionId = await openQuestionId({ environment });
    await tap({ environment, questionId: firstQuestionId, optionIndex: 0, optionTitle: 'Sim' });
    await waiting;
    await environment.clock.advance({ ms: ASK_RETRY_WINDOW_MS + 1 });
    const retry = asking({ environment, timeoutMs: SECOND_MS });
    await environment.clock.advance({ ms: SECOND_MS });
    const result = await retry;
    expect(result.status).toBe(ReplyStatus.Pending);
    expect(result).not.toMatchObject({ questionId: firstQuestionId });
    expect(environment.sender.sessions).toHaveLength(2);
  });

  test('CU-106 two agents asking the same thing get two questions', async () => {
    const environment = await createEnvironment();
    const first = asking({ environment, timeoutMs: SECOND_MS });
    const second = asking({ environment, timeoutMs: SECOND_MS, connection: connectionOf({ agent: 'beta' }) });
    await environment.clock.advance({ ms: SECOND_MS });
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).not.toEqual(secondResult);
    expect(environment.sender.sessions).toHaveLength(2);
  });

  test('CU-107 the key ignores case and spacing', async () => {
    const environment = await createEnvironment();
    const first = asking({ environment, text: 'Deploy?', options: ['Sim'], timeoutMs: SECOND_MS });
    await environment.clock.advance({ ms: 0 });
    const second = asking({ environment, text: '  Deploy?  ', options: ['  Sim '], timeoutMs: SECOND_MS });
    await environment.clock.advance({ ms: SECOND_MS });
    expect(await second).toEqual(await first);
    expect(environment.sender.sessions).toHaveLength(1);
  });

  test('CU-108 holds exactly until the maximum wait', async () => {
    const environment = await createEnvironment();
    let hasSettled = false;
    const waiting = asking({ environment }).then((result) => {
      hasSettled = true;
      return result;
    });
    await environment.clock.advance({ ms: ASK_MAX_WAIT_MS - 1 });
    expect(hasSettled).toBe(false);
    await environment.clock.advance({ ms: 1 });
    expect(await waiting).toEqual({ status: ReplyStatus.Pending, questionId: 'qst_1' });
  });

  test('CU-109 outside the window the prompt queues and one question notice goes out', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    const waiting = asking({ environment, timeoutMs: SECOND_MS });
    await environment.clock.advance({ ms: SECOND_MS });
    await waiting;
    expect(environment.sender.sessions).toHaveLength(0);
    expect(environment.sender.templates).toHaveLength(1);
    expect(environment.sender.templates[0]).toMatchObject({ kind: TemplateKind.QuestionNotice, parameters: ['alpha', 'Deploy?'] });
    expect((await environment.repository.listQueued()).map((message) => message.delivery)).toEqual([DeliveryState.Queued]);
  });

  test('CU-110 outside the window after the notice sends no second notice', async () => {
    const environment = await createEnvironment();
    await environment.repository.saveWindow({
      window: {
        lastOwnerMessageAt: environment.clock.now() - WINDOW_MS,
        noticeSentForClosedWindow: true,
        closedAt: null,
        noticeRetryLocale: null,
        noticeRetryAt: null,
        noticeRetryAttempt: 0,
      },
    });
    const waiting = asking({ environment, timeoutMs: SECOND_MS });
    await environment.clock.advance({ ms: SECOND_MS });
    await waiting;
    expect(environment.sender.templates).toHaveLength(0);
    expect(await environment.repository.listQueued()).toHaveLength(1);
  });

  test('a prompt that failed to deliver is sent again by the retry', async () => {
    const environment = await createEnvironment();
    environment.sender.failSessionCalls({ callNumbers: [1] });
    const error = await captureInboxError(() => asking({ environment, timeoutMs: SECOND_MS }));
    expect(error.code).toBe(ChannelErrorKind.DeliveryFailed);
    const retry = asking({ environment, timeoutMs: SECOND_MS });
    await environment.clock.advance({ ms: SECOND_MS });
    expect((await retry).status).toBe(ReplyStatus.Pending);
    expect(environment.sender.sessions).toMatchObject([{ kind: MessageKind.Choice, questionId: 'qst_2' }]);
  });

  test('the prompt carries its options with descriptions', async () => {
    const environment = await createEnvironment();
    const waiting = asking({
      environment,
      options: ['a', 'b', 'c', 'd'],
      optionDescriptions: ['one', null, null, 'four'],
      timeoutMs: SECOND_MS,
    });
    await environment.clock.advance({ ms: SECOND_MS });
    await waiting;
    expect(environment.sender.sessions[0]).toMatchObject({
      kind: MessageKind.Choice,
      questionId: 'qst_1',
      selected: null,
      options: [
        { optionIndex: 0, title: 'a', description: 'one' },
        { optionIndex: 1, title: 'b', description: null },
        { optionIndex: 2, title: 'c', description: null },
        { optionIndex: 3, title: 'd', description: 'four' },
      ],
    });
  });

  test('descriptions that do not match the options are rejected', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() => asking({ environment, optionDescriptions: ['only one'] }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'option_descriptions: must match options' });
  });

  test('a question over the limit is rejected', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() => asking({ environment, text: 'q'.repeat(1025) }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'question: must be at most 1024 characters' });
  });

  test('no options are rejected', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() => asking({ environment, options: [] }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'options: must have 1 to 10 entries' });
  });
});
