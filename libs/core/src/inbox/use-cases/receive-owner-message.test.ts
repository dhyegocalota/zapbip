import {
  AgentWakeReason,
  DeliveryState,
  InboxCopyKey,
  InboxErrorCode,
  InboxStatus,
  MediaOrigin,
  MessageKind,
  OwnerLocale,
  ReplyStatus,
  SECOND_MS,
  WakeOutcome,
  ForwardedKind,
} from '@zapbip/types';
import { describe, expect, test, vi } from 'vitest';
import { MEDIA_RETENTION_MS, NOTICE_QUICK_REPLY_ID, QUEUE_RETENTION_MS, ROUTING_LIST_TTL_MS, WINDOW_MS } from '../constants';
import { renderCopy } from '../inbox-copy';
import type { Message } from '../message';
import { formatChoiceOptionIds, formatOptionId, formatRouteOptionId } from '../option-id';
import { captureInboxError } from '../testing/capture-inbox-error';
import {
  askAndAbandon,
  closeWindow,
  connectionOf,
  createEnvironment,
  receive,
  receiveText,
  registerAgents,
  START_AT,
} from '../testing/fixtures';
import { ask } from './ask';
import { checkInbox } from './check-inbox';
import { sendText } from './send-text';
import { waitForReply } from './wait-for-reply';

type Environment = Awaited<ReturnType<typeof createEnvironment>>;

function send(input: { environment: Environment; agent?: string; text: string }) {
  const { environment, agent = 'alpha', text } = input;
  return sendText({ dependencies: environment.dependencies, connection: connectionOf({ agent }), text, replyToMessageId: null });
}

function waiting(input: { environment: Environment; agent: string }) {
  return waitForReply({
    dependencies: input.environment.dependencies,
    connection: connectionOf({ agent: input.agent }),
    questionId: null,
    timeoutMs: 5 * SECOND_MS,
  });
}

function tap(input: { environment: Environment; optionId: string; optionTitle: string }) {
  return receive({
    environment: input.environment,
    content: { kind: MessageKind.Choice, optionId: input.optionId, optionTitle: input.optionTitle, optionDescription: null },
  });
}

function notListeningText(input: { agent: string }): string {
  return renderCopy({
    key: InboxCopyKey.AgentNotListening,
    locale: OwnerLocale.EnglishUs,
    values: { agent: input.agent },
  });
}

function sessionTexts(input: { environment: Environment }): string[] {
  return input.environment.sender.sessions.flatMap((message) => (message.kind === MessageKind.Text ? [message.text] : []));
}

function expiredListText(): string {
  return renderCopy({ key: InboxCopyKey.RoutingListExpired, locale: OwnerLocale.EnglishUs, values: {} });
}

function reminderText(): string {
  return renderCopy({ key: InboxCopyKey.RoutingListReminder, locale: OwnerLocale.EnglishUs, values: {} });
}

function routingLists(input: { environment: Environment }): Message[] {
  return input.environment.sender.sessions.filter((message) => message.kind === MessageKind.Choice);
}

function routeOptionId(input: { list: Message; agent: string }): string {
  if (input.list.kind !== MessageKind.Choice) throw new Error('expected a routing list');
  const ids = formatChoiceOptionIds({ questionId: input.list.questionId, options: input.list.options });
  const optionId = ids.find((id) => id.endsWith(`:${input.agent}`));
  if (optionId === undefined) throw new Error(`no option for ${input.agent}`);
  return optionId;
}

describe('receiveOwnerMessage routing', () => {
  test('CU-190 with exactly one agent an unaddressed text reaches it and no list is sent', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    const holding = waiting({ environment, agent: 'alpha' });
    await environment.clock.advance({ ms: 0 });
    const result = await receiveText({ environment, text: 'oi' });
    expect(result).toMatchObject({ agent: 'alpha', duplicate: false });
    expect(await holding).toMatchObject({ status: ReplyStatus.Message, messages: [{ text: 'oi' }] });
    expect(routingLists({ environment })).toEqual([]);
    expect(await environment.repository.listHeld()).toEqual([]);
  });

  test('CU-132 a text with the window closed opens it and wakes the waiting agent', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    await environment.repository.saveWindow({
      window: {
        lastOwnerMessageAt: null,
        noticeSentForClosedWindow: false,
        closedAt: null,
        noticeRetryLocale: null,
        noticeRetryAt: null,
        noticeRetryAttempt: 0,
      },
    });
    const holding = waiting({ environment, agent: 'alpha' });
    await environment.clock.advance({ ms: 0 });
    const result = await receiveText({ environment, text: '@alpha oi' });
    expect(result).toMatchObject({ agent: 'alpha', duplicate: false });
    expect((await environment.repository.findWindow()).lastOwnerMessageAt).toBe(environment.clock.now());
    expect(await holding).toMatchObject({ status: ReplyStatus.Message, messages: [{ text: 'oi' }] });
    expect(environment.waker.notifications).toEqual([]);
  });

  test('CU-132 the routed message is stored unread', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    const result = await receiveText({ environment, text: '@alpha oi' });
    expect(await environment.repository.findMessage({ messageId: result.messageId! })).toMatchObject({
      agent: 'alpha',
      readByAgent: false,
      forwarded: ForwardedKind.None,
      text: 'oi',
    });
  });

  test('a forwarded message is stored with the forwarded flag', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    const result = await receive({
      environment,
      content: { kind: MessageKind.Text, text: '@alpha oi' },
      forwarded: ForwardedKind.Forwarded,
    });
    expect(await environment.repository.findMessage({ messageId: result.messageId! })).toMatchObject({
      forwarded: ForwardedKind.Forwarded,
    });
  });

  test('CU-67 CU-136 a tap on an open question answers it with the option title', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment });
    const result = await tap({
      environment,
      optionId: formatOptionId({ questionId: question.questionId, optionIndex: 1 }),
      optionTitle: 'Não',
    });
    expect(result.agent).toBe('alpha');
    expect((await environment.repository.findQuestion({ questionId: question.questionId }))?.answer).toMatchObject({
      optionIndex: 1,
      text: 'Não',
      answerMessageId: result.messageId,
    });
    expect(await environment.repository.findMessage({ messageId: result.messageId! })).toMatchObject({
      kind: MessageKind.Choice,
      agent: 'alpha',
      selected: { optionIndex: 1, title: 'Não' },
    });
  });

  test('CU-137 a stale tap is routed as a message with reply_to and never answers twice', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment });
    const optionId = formatOptionId({ questionId: question.questionId, optionIndex: 0 });
    const first = await tap({ environment, optionId, optionTitle: 'Sim' });
    const stale = await tap({
      environment,
      optionId: formatOptionId({ questionId: question.questionId, optionIndex: 1 }),
      optionTitle: 'Não',
    });
    expect(stale.agent).toBe('alpha');
    expect(await environment.repository.findMessage({ messageId: stale.messageId! })).toMatchObject({
      kind: MessageKind.Text,
      text: 'Não',
      replyToMessageId: question.promptMessageId,
    });
    expect((await environment.repository.findQuestion({ questionId: question.questionId }))?.answer).toMatchObject({
      text: 'Sim',
      answerMessageId: first.messageId,
    });
  });

  test('CU-138 a tap on an unknown question is routed as text', async () => {
    const environment = await createEnvironment();
    await send({ environment, text: 'hello' });
    const result = await tap({ environment, optionId: 'qst_missing:0', optionTitle: 'Sim' });
    expect(result.agent).toBe('alpha');
    expect(await environment.repository.findMessage({ messageId: result.messageId! })).toMatchObject({
      kind: MessageKind.Text,
      text: 'Sim',
    });
  });

  test('CU-120 a reaction to a question prompt answers it without opening the window', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment });
    const windowBefore = await environment.repository.findWindow();
    await environment.clock.advance({ ms: SECOND_MS });
    const result = await receive({
      environment,
      content: { kind: MessageKind.Reaction, targetMessageId: question.promptMessageId, emoji: '👍' },
    });
    expect(result.agent).toBe('alpha');
    expect((await environment.repository.findQuestion({ questionId: question.questionId }))?.answer).toMatchObject({
      optionIndex: null,
      text: '👍',
      answerMessageId: result.messageId,
    });
    expect(await environment.repository.findWindow()).toEqual(windowBefore);
  });

  test('a removed reaction does not answer', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment });
    await receive({ environment, content: { kind: MessageKind.Reaction, targetMessageId: question.promptMessageId, emoji: null } });
    expect((await environment.repository.findQuestion({ questionId: question.questionId }))?.answer).toBeNull();
  });

  test('CU-149 owner media is routed to the agent with the open question and does not answer', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment });
    const result = await receive({
      environment,
      content: {
        kind: MessageKind.Image,
        voice: false,
        mediaId: 'wamid.media',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
        filename: null,
        caption: null,
      },
    });
    expect(result.agent).toBe('alpha');
    expect((await environment.repository.findQuestion({ questionId: question.questionId }))?.answer).toBeNull();
  });

  test('a location does not answer either', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment });
    await receive({ environment, content: { kind: MessageKind.Location, latitude: 1, longitude: 2, name: null, address: null } });
    expect((await environment.repository.findQuestion({ questionId: question.questionId }))?.answer).toBeNull();
  });

  test('a quoted reply goes to the agent that wrote the quoted message', async () => {
    const environment = await createEnvironment();
    const fromBeta = await send({ environment, agent: 'beta', text: 'from beta' });
    await send({ environment, agent: 'alpha', text: 'last word' });
    const result = await receiveText({ environment, text: 'ok', replyToMessageId: fromBeta.messageId });
    expect(result.agent).toBe('beta');
  });
});

describe('receiveOwnerMessage routing list', () => {
  test('CU-139 a route choice assigns every held message and wakes the agent', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    const holding = waiting({ environment, agent: 'beta' });
    await environment.clock.advance({ ms: 0 });
    await receiveText({ environment, text: 'first' });
    await receiveText({ environment, text: 'second' });
    const [list] = routingLists({ environment });
    const result = await tap({ environment, optionId: routeOptionId({ list: list!, agent: 'beta' }), optionTitle: 'beta' });
    expect(result).toMatchObject({ messageId: null, agent: 'beta' });
    expect(await environment.repository.listHeld()).toEqual([]);
    expect(await holding).toMatchObject({ status: ReplyStatus.Message, messages: [{ text: 'first' }, { text: 'second' }] });
  });

  test('CU-140 a route choice for a batch already resolved assigns nothing and is answered with the expired notice', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'first' });
    const [list] = routingLists({ environment });
    const optionId = routeOptionId({ list: list!, agent: 'alpha' });
    await tap({ environment, optionId, optionTitle: 'alpha' });
    const stale = await tap({ environment, optionId, optionTitle: 'beta' });
    expect(stale).toEqual({ messageId: null, agent: null, duplicate: false });
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(1);
    expect(await environment.repository.listHeld()).toEqual([]);
    expect(sessionTexts({ environment }).at(-1)).toBe(expiredListText());
  });

  test('CU-163 a route choice naming an unknown agent while the batch is held sends the current list again', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    const held = await receiveText({ environment, text: 'first' });
    const result = await tap({
      environment,
      optionId: formatRouteOptionId({ messageId: held.messageId!, agent: 'ghost' }),
      optionTitle: 'ghost',
    });
    expect(result).toEqual({ messageId: null, agent: null, duplicate: false });
    expect(await environment.repository.countUnread({ agent: 'ghost' })).toBe(0);
    expect(await environment.repository.listHeld()).toHaveLength(1);
    const lists = routingLists({ environment });
    expect(lists).toHaveLength(2);
    expect(sessionTexts({ environment })).toEqual([]);
    expect(await environment.repository.findRoutingList()).toMatchObject({ promptMessageId: lists[1]!.messageId });
    expect(
      formatChoiceOptionIds({
        questionId: (lists[1] as { questionId: string }).questionId,
        options: [{ optionIndex: 0, title: 'alpha', description: null }],
      }),
    ).toEqual([formatRouteOptionId({ messageId: held.messageId!, agent: 'alpha' })]);
  });

  test('while a routing list is open a recent agent does not receive new unmatched texts ahead of the held ones', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'hello' });
    const [list] = routingLists({ environment });
    await send({ environment, agent: 'alpha', text: 'working on it' });
    const held = await receiveText({ environment, text: 'x' });
    expect(held.agent).toBeNull();
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(0);
    await tap({ environment, optionId: routeOptionId({ list: list!, agent: 'alpha' }), optionTitle: 'alpha' });
    const inbox = await checkInbox({ dependencies: environment.dependencies, connection: connectionOf({ agent: 'alpha' }) });
    expect(inbox.messages.map((message) => (message.kind === MessageKind.Text ? message.text : null))).toEqual(['hello', 'x']);
  });

  test('CU-141 a second unmatched message joins the held ones without a new list', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'first' });
    const second = await receiveText({ environment, text: 'second' });
    expect(routingLists({ environment })).toHaveLength(1);
    expect(environment.sender.templates).toHaveLength(0);
    expect(second.agent).toBeNull();
    expect(await environment.repository.listHeld()).toHaveLength(2);
  });

  test('CU-142 the routing list holds the ten most recent agents, newest first', async () => {
    const environment = await createEnvironment();
    const agents = Array.from({ length: 12 }, (_, index) => `agent-${index + 1}`);
    await agents.reduce(
      (previous, agent) =>
        previous.then(() => environment.clock.advance({ ms: SECOND_MS })).then(() => registerAgents({ environment, agents: [agent] })),
      Promise.resolve(),
    );
    const held = await receiveText({ environment, text: 'hello' });
    const [list] = routingLists({ environment });
    if (list === undefined || list.kind !== MessageKind.Choice) throw new Error('expected a routing list');
    const optionIds = formatChoiceOptionIds({ questionId: list.questionId, options: list.options });
    expect(optionIds).toEqual(
      agents
        .slice(2)
        .reverse()
        .map((agent) => formatRouteOptionId({ messageId: held.messageId!, agent })),
    );
  });

  test('CU-143 with no agents the owner gets one notice and the message is held', async () => {
    const environment = await createEnvironment();
    const result = await receiveText({ environment, text: 'hello' });
    expect(routingLists({ environment })).toEqual([]);
    expect(sessionTexts({ environment })).toEqual([renderCopy({ key: InboxCopyKey.NoAgents, locale: OwnerLocale.EnglishUs, values: {} })]);
    expect(await environment.repository.listHeld()).toMatchObject([{ messageId: result.messageId, agent: null }]);
  });

  test('a reaction nobody can be routed to is stored as routed nowhere without prompting a closed window', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'hello' });
    const [list] = routingLists({ environment });
    await tap({ environment, optionId: routeOptionId({ list: list!, agent: 'beta' }), optionTitle: 'beta' });
    await closeWindow({ environment });
    const sessionsBefore = environment.sender.sessions.length;
    const result = await receive({ environment, content: { kind: MessageKind.Reaction, targetMessageId: list!.messageId, emoji: '👍' } });
    expect(result.agent).toBeNull();
    expect(environment.sender.sessions).toHaveLength(sessionsBefore);
    expect(environment.sender.templates).toHaveLength(0);
    expect(await environment.repository.listHeld()).toEqual([]);
    expect(await environment.repository.findMessage({ messageId: result.messageId! })).toMatchObject({ agent: null, readByAgent: true });
  });

  test('a reaction to an unknown message does not suppress the routing list of the next text', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receive({ environment, content: { kind: MessageKind.Reaction, targetMessageId: 'msg_unknown', emoji: '👍' } });
    await receiveText({ environment, text: 'hello' });
    expect(routingLists({ environment })).toHaveLength(1);
  });

  test('a routing list that failed to send does not suppress the next one', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    environment.sender.failSessionCalls({ callNumbers: [1] });
    await expect(receiveText({ environment, text: 'first' })).rejects.toThrow();
    await receiveText({ environment, text: 'second' });
    expect(routingLists({ environment })).toHaveLength(1);
  });

  test('pin: after the first agent takes the held message of the no-agents notice, the next unmatched text gets a routing list', async () => {
    const environment = await createEnvironment();
    await receiveText({ environment, text: 'anyone?' });
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'hello' });
    expect(routingLists({ environment })).toHaveLength(1);
    expect(await environment.repository.listHeld()).toHaveLength(1);
  });
});

describe('receiveOwnerMessage window and queue', () => {
  test('CU-119 a reaction neither opens the window nor flushes the queue', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    const queued = await send({ environment, text: 'queued' });
    const windowBefore = await environment.repository.findWindow();
    await receive({ environment, content: { kind: MessageKind.Reaction, targetMessageId: queued.messageId, emoji: '👍' } });
    expect(await environment.repository.findMessage({ messageId: queued.messageId })).toMatchObject({ delivery: DeliveryState.Queued });
    expect(environment.sender.sessions).toHaveLength(0);
    expect(await environment.repository.findWindow()).toEqual(windowBefore);
  });

  test('CU-133 the queue flushes in order without a new notice', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    const queued = await ['one', 'two', 'three'].reduce<Promise<string[]>>(
      (previous, text) =>
        previous.then(async (ids) => {
          await environment.clock.advance({ ms: SECOND_MS });
          return [...ids, (await send({ environment, text })).messageId];
        }),
      Promise.resolve([]),
    );
    await receiveText({ environment, text: '@alpha ok' });
    expect(sessionTexts({ environment }).slice(0, 3)).toEqual(['one', 'two', 'three']);
    const states = await Promise.all(queued.map((messageId) => environment.repository.findMessage({ messageId })));
    expect(states.map((message) => message?.delivery)).toEqual([DeliveryState.Sent, DeliveryState.Sent, DeliveryState.Sent]);
    expect(environment.sender.templates).toHaveLength(1);
  });

  test('a session send during the flush waits behind the queue', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    await send({ environment, text: 'one' });
    await send({ environment, text: 'two' });
    environment.sender.holdSessions();
    const flushing = receiveText({ environment, text: '@alpha ok' });
    await environment.clock.advance({ ms: 0 });
    const sending = send({ environment, text: 'three' });
    await environment.clock.advance({ ms: 0 });
    environment.sender.releaseSessions();
    await Promise.all([flushing, sending]);
    expect(sessionTexts({ environment }).slice(0, 3)).toEqual(['one', 'two', 'three']);
  });

  test('a second owner message during the flush sends every queued message once and in order', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    await send({ environment, text: 'one' });
    await send({ environment, text: 'two' });
    environment.sender.holdSessions();
    const first = receiveText({ environment, text: '@alpha a' });
    await environment.clock.advance({ ms: 0 });
    const second = receiveText({ environment, text: '@alpha b' });
    await environment.clock.advance({ ms: 0 });
    environment.sender.releaseSessions();
    await Promise.all([first, second]);
    expect(sessionTexts({ environment }).slice(0, 2)).toEqual(['one', 'two']);
    expect(sessionTexts({ environment }).filter((text) => text === 'one' || text === 'two')).toHaveLength(2);
  });

  test('CU-134 a queued message past its retention expires instead of being sent', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    const old = await send({ environment, text: 'old' });
    await environment.clock.advance({ ms: QUEUE_RETENTION_MS + 1 });
    const fresh = await send({ environment, text: 'new' });
    await receiveText({ environment, text: '@alpha ok' });
    expect(await environment.repository.findMessage({ messageId: old.messageId })).toMatchObject({ delivery: DeliveryState.Expired });
    expect(await environment.repository.findMessage({ messageId: fresh.messageId })).toMatchObject({ delivery: DeliveryState.Sent });
    expect(sessionTexts({ environment })).not.toContain('old');
  });

  test('CU-135 a failure in the flush does not stop the rest', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    const ids = await ['one', 'two', 'three'].reduce<Promise<string[]>>(
      (previous, text) => previous.then(async (sent) => [...sent, (await send({ environment, text })).messageId]),
      Promise.resolve([]),
    );
    environment.sender.failSessionCalls({ callNumbers: [2] });
    await receiveText({ environment, text: '@alpha ok' });
    const states = await Promise.all(ids.map((messageId) => environment.repository.findMessage({ messageId })));
    expect(states.map((message) => message?.delivery)).toEqual([DeliveryState.Sent, DeliveryState.Failed, DeliveryState.Sent]);
  });

  test('CU-144 the notice quick reply only opens the window and flushes the queue', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    const queued = await send({ environment, text: 'queued' });
    const result = await tap({ environment, optionId: NOTICE_QUICK_REPLY_ID, optionTitle: 'Open' });
    expect(result.messageId).toBeNull();
    expect((await environment.repository.findWindow()).lastOwnerMessageAt).toBe(environment.clock.now());
    expect(await environment.repository.findMessage({ messageId: queued.messageId })).toMatchObject({ delivery: DeliveryState.Sent });
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(0);
    expect(await environment.repository.listHeld()).toEqual([]);
  });

  test('CU-147 an owner message clears the closed window notice flag', async () => {
    const environment = await createEnvironment();
    await environment.repository.saveWindow({
      window: {
        lastOwnerMessageAt: START_AT - WINDOW_MS,
        noticeSentForClosedWindow: true,
        closedAt: null,
        noticeRetryLocale: null,
        noticeRetryAt: null,
        noticeRetryAttempt: 0,
      },
    });
    await receiveText({ environment, text: 'hello' });
    expect((await environment.repository.findWindow()).noticeSentForClosedWindow).toBe(false);
  });
});

describe('receiveOwnerMessage waking', () => {
  test('CU-145 the waker is told once per unread batch and the owner learns the agent is not listening', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    const first = await receiveText({ environment, text: '@alpha one' });
    await receiveText({ environment, text: '@alpha two' });
    expect(environment.waker.notifications).toEqual([
      { agent: 'alpha', reason: AgentWakeReason.MessageWaiting, messageId: first.messageId },
    ]);
    expect(sessionTexts({ environment })).toEqual([notListeningText({ agent: 'alpha' })]);
  });

  test('a woken agent costs the owner no notice', async () => {
    const environment = await createEnvironment();
    environment.waker.replyWith({ outcome: WakeOutcome.Woken });
    await registerAgents({ environment, agents: ['alpha'] });
    await receiveText({ environment, text: '@alpha one' });
    expect(environment.waker.notifications).toHaveLength(1);
    expect(environment.sender.sessions).toHaveLength(0);
  });

  test('an agent whose wake failed is told again for the next message while earlier ones are unread', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    await receiveText({ environment, text: '@alpha one' });
    environment.waker.failWakesOf({ agent: 'alpha' });
    await receiveText({ environment, text: '@alpha two' });
    expect(environment.waker.notifications).toHaveLength(2);
  });

  test('CU-146 a live waiter skips the waker', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    const holding = waiting({ environment, agent: 'alpha' });
    await environment.clock.advance({ ms: 0 });
    await receiveText({ environment, text: '@alpha one' });
    expect(environment.waker.notifications).toEqual([]);
    expect((await holding).status).toBe(ReplyStatus.Message);
  });
});

describe('receiveOwnerMessage handing the message id to the waker', () => {
  test('a plain message passes its id', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    const received = await receiveText({ environment, text: '@alpha one' });
    expect(environment.waker.notifications).toEqual([
      { agent: 'alpha', reason: AgentWakeReason.MessageWaiting, messageId: received.messageId },
    ]);
  });

  test('a second message in the same batch does not call the waker', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    await receiveText({ environment, text: '@alpha one' });
    await receiveText({ environment, text: '@alpha two' });
    expect(environment.waker.notifications).toHaveLength(1);
  });

  test('a choice that answers a question passes no id', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment, agent: 'alpha' });
    await tap({
      environment,
      optionId: formatOptionId({ questionId: question.questionId, optionIndex: 0 }),
      optionTitle: 'Sim',
    });
    expect(environment.waker.notifications).toEqual([{ agent: 'alpha', reason: AgentWakeReason.MessageWaiting }]);
    expect(environment.waker.notifications.map((notification) => notification.messageId)).toEqual([undefined]);
  });

  test('held messages assigned by a routing-list tap pass no id', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'hello' });
    const [list] = routingLists({ environment });
    await tap({ environment, optionId: routeOptionId({ list: list!, agent: 'beta' }), optionTitle: 'beta' });
    expect(environment.waker.notifications.map((notification) => notification.messageId)).toEqual([undefined]);
  });
});

describe('receiveOwnerMessage waking an agent that holds an ask', () => {
  test('owner media reaching an agent that only waits for an answer wakes it and tells the owner', async () => {
    const environment = await createEnvironment();
    const asking = ask({
      dependencies: environment.dependencies,
      connection: connectionOf({ agent: 'alpha' }),
      text: 'Deploy?',
      options: ['Sim', 'Não'],
      optionDescriptions: [],
      timeoutMs: 5 * SECOND_MS,
    });
    await environment.clock.advance({ ms: 0 });
    const received = await receive({
      environment,
      content: {
        kind: MessageKind.Image,
        voice: false,
        mediaId: 'wamid.media',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
        filename: null,
        caption: null,
      },
    });
    expect(environment.waker.notifications).toEqual([
      { agent: 'alpha', reason: AgentWakeReason.MessageWaiting, messageId: received.messageId },
    ]);
    expect(sessionTexts({ environment })).toEqual([notListeningText({ agent: 'alpha' })]);
    await environment.clock.advance({ ms: 5 * SECOND_MS });
    await asking;
  });
});

describe('receiveOwnerMessage media and receipts', () => {
  test('CU-148 owner media is stored with its retention', async () => {
    const environment = await createEnvironment();
    await receive({
      environment,
      content: {
        kind: MessageKind.Image,
        voice: false,
        mediaId: 'wamid.1',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
        filename: null,
        caption: 'look',
      },
    });
    const now = environment.clock.now();
    expect(await environment.repository.findMedia({ mediaId: 'wamid.1' })).toMatchObject({
      origin: MediaOrigin.Owner,
      mimeType: 'image/jpeg',
      sizeBytes: 1000,
      receivedAt: now,
      retentionUntil: now + MEDIA_RETENTION_MS,
    });
  });

  test('a repeated channel message returns the original message id', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    const content = { kind: MessageKind.Text, text: '@alpha hi' } as const;
    const original = await receive({ environment, content, channelMessageId: 'wamid.same' });
    const repeated = await receive({ environment, content, channelMessageId: 'wamid.same' });
    expect(repeated).toEqual({ messageId: original.messageId, agent: 'alpha', duplicate: true });
  });

  test('CU-150 a repeated channel message is ignored', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    const first = await receive({ environment, content: { kind: MessageKind.Text, text: '@alpha hi' }, channelMessageId: 'wamid.same' });
    const second = await receive({ environment, content: { kind: MessageKind.Text, text: '@alpha hi' }, channelMessageId: 'wamid.same' });
    expect(first.duplicate).toBe(false);
    expect(second).toEqual({ messageId: first.messageId, agent: 'alpha', duplicate: true });
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(1);
  });

  test('CU-151 a voice flag on a non-audio kind is rejected', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() =>
      receive({
        environment,
        content: {
          kind: MessageKind.Image,
          voice: true,
          mediaId: 'wamid.1',
          mimeType: 'image/jpeg',
          sizeBytes: 1000,
          filename: null,
          caption: null,
        },
      }),
    );
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'voice: only audio can be a voice note' });
    expect(await environment.repository.findMedia({ mediaId: 'wamid.1' })).toBeNull();
  });
});

describe('receiveOwnerMessage retries and concurrency', () => {
  test('two simultaneous owner messages flush the queue once', async () => {
    const environment = await createEnvironment();
    await closeWindow({ environment });
    await send({ environment, text: 'queued' });
    await Promise.all([receiveText({ environment, text: '@alpha one' }), receiveText({ environment, text: '@alpha two' })]);
    expect(sessionTexts({ environment }).filter((text) => text === 'queued')).toHaveLength(1);
  });

  test('a failure before the message is stored lets the retry store it', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    const listOpenQuestions = environment.repository.listOpenQuestions.bind(environment.repository);
    environment.repository.listOpenQuestions = async () => {
      environment.repository.listOpenQuestions = listOpenQuestions;
      throw new Error('storage unavailable');
    };
    const content = { kind: MessageKind.Text, text: '@alpha hi' } as const;
    await expect(receive({ environment, content, channelMessageId: 'wamid.retry' })).rejects.toThrow('storage unavailable');
    const retry = await receive({ environment, content, channelMessageId: 'wamid.retry' });
    expect(retry).toMatchObject({ agent: 'alpha', duplicate: false });
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(1);
  });

  test('pin: a failure after the message is stored makes the retry a duplicate and keeps the message unread', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    environment.sender.failSessionCalls({ callNumbers: [1] });
    const content = { kind: MessageKind.Text, text: '@alpha hi' } as const;
    await expect(receive({ environment, content, channelMessageId: 'wamid.retry' })).rejects.toThrow();
    const retry = await receive({ environment, content, channelMessageId: 'wamid.retry' });
    expect(retry.duplicate).toBe(true);
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(1);
  });

  test('a message held before the first agent reaches that agent on its first contact', async () => {
    const environment = await createEnvironment();
    await receiveText({ environment, text: 'anyone?' });
    const inbox = await checkInbox({ dependencies: environment.dependencies, connection: connectionOf({ agent: 'alpha' }) });
    expect(inbox).toMatchObject({ status: InboxStatus.New, messages: [{ text: 'anyone?' }] });
    expect(await environment.repository.listHeld()).toEqual([]);
  });

  test('a second agent does not take the held messages of the routing list', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'first' });
    await registerAgents({ environment, agents: ['gamma'] });
    expect(await environment.repository.listHeld()).toHaveLength(1);
  });
});

describe('receiveOwnerMessage routing list state', () => {
  test('CU-160 the first list is recorded in the owner window row', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'first' });
    const [list] = routingLists({ environment });
    expect(await environment.repository.findRoutingList()).toEqual({
      promptMessageId: list!.messageId,
      openedAt: environment.clock.now(),
      locale: OwnerLocale.EnglishUs,
      resent: false,
      reminded: false,
    });
  });

  test('an unknown-agent tap resends the list keeping the timer, the reminder and the resend flag', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    const held = await receiveText({ environment, text: 'first' });
    await receiveText({ environment, text: 'second' });
    const before = (await environment.repository.findRoutingList())!;
    await environment.clock.advance({ ms: SECOND_MS });
    await tap({ environment, optionId: formatRouteOptionId({ messageId: held.messageId!, agent: 'ghost' }), optionTitle: 'ghost' });
    await receiveText({ environment, text: 'third' });
    expect(await environment.repository.findRoutingList()).toMatchObject({
      openedAt: before.openedAt,
      resent: before.resent,
      reminded: true,
    });
    expect(sessionTexts({ environment })).toEqual([reminderText()]);
  });

  test('CU-178 pin: a stale tap leaves the waiter of another question waiting', async () => {
    const environment = await createEnvironment();
    const answered = await askAndAbandon({ environment, text: 'First?' });
    await tap({ environment, optionId: formatOptionId({ questionId: answered.questionId, optionIndex: 0 }), optionTitle: 'Sim' });
    const open = await askAndAbandon({ environment, text: 'Second?' });
    const waitingForAnswer = waitForReply({
      dependencies: environment.dependencies,
      connection: connectionOf({ agent: 'alpha' }),
      questionId: open.questionId,
      timeoutMs: 5 * SECOND_MS,
    });
    await environment.clock.advance({ ms: 0 });
    await tap({ environment, optionId: formatOptionId({ questionId: answered.questionId, optionIndex: 1 }), optionTitle: 'Não' });
    await environment.clock.advance({ ms: 5 * SECOND_MS });
    expect(await waitingForAnswer).toMatchObject({ status: ReplyStatus.Timeout });
  });

  test('CU-178 a photo quoting an open question prompt wakes the ordinary wait with the photo', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment });
    const holding = waiting({ environment, agent: 'alpha' });
    await environment.clock.advance({ ms: 0 });
    await receive({
      environment,
      replyToMessageId: question.promptMessageId,
      content: {
        kind: MessageKind.Image,
        voice: false,
        mediaId: 'wamid.quoting-photo',
        mimeType: 'image/jpeg',
        sizeBytes: 1000,
        filename: null,
        caption: null,
      },
    });
    expect(await holding).toMatchObject({ status: ReplyStatus.Message, messages: [{ kind: MessageKind.Image }] });
    expect(environment.waker.notifications).toEqual([]);
    expect(sessionTexts({ environment })).toEqual([]);
  });

  test('CU-160 a list that failed to send leaves no row', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    environment.sender.failSessionCalls({ callNumbers: [1] });
    await expect(receiveText({ environment, text: 'first' })).rejects.toThrow();
    expect(await environment.repository.findRoutingList()).toBeNull();
  });

  test('CU-160 a route choice closes the list', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'first' });
    const [list] = routingLists({ environment });
    await tap({ environment, optionId: routeOptionId({ list: list!, agent: 'beta' }), optionTitle: 'beta' });
    expect(await environment.repository.findRoutingList()).toBeNull();
  });

  test('CU-161 the owner gets one localized reminder per batch, quoting the list', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'first' });
    const [list] = routingLists({ environment });
    await receiveText({ environment, text: 'second' });
    await receiveText({ environment, text: 'third' });
    expect(sessionTexts({ environment })).toEqual([reminderText()]);
    expect(environment.sender.sessions.at(-1)).toMatchObject({ replyToMessageId: list!.messageId });
    expect(routingLists({ environment })).toHaveLength(1);
    expect(await environment.repository.listHeld()).toHaveLength(3);
  });

  test('CU-161 the reminder is written in the locale of the message that triggers it', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'first' });
    await receive({ environment, content: { kind: MessageKind.Text, text: 'segunda' }, ownerLocale: OwnerLocale.PortugueseBrazil });
    expect(sessionTexts({ environment })).toEqual(['Escolha o agente na lista acima']);
  });

  test('CU-162 a message matched by rules 1 to 4 is never held and never reminds', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'first' });
    const matched = await receiveText({ environment, text: '@beta hi' });
    expect(matched.agent).toBe('beta');
    expect(sessionTexts({ environment })).not.toContain(reminderText());
    expect(await environment.repository.listHeld()).toHaveLength(1);
  });

  test('a reaction nobody can be routed to does not remind the owner', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'first' });
    await receive({ environment, content: { kind: MessageKind.Reaction, targetMessageId: 'msg_unknown', emoji: '👍' } });
    expect(sessionTexts({ environment })).toEqual([]);
  });

  test('a message after the list expired and was answered gets a new list', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receiveText({ environment, text: 'first' });
    const [list] = routingLists({ environment });
    await tap({ environment, optionId: routeOptionId({ list: list!, agent: 'beta' }), optionTitle: 'beta' });
    await environment.clock.advance({ ms: ROUTING_LIST_TTL_MS });
    await receiveText({ environment, text: 'again' });
    expect(routingLists({ environment })).toHaveLength(2);
  });
});
