import { InboxCopyKey, MessageKind, OwnerLocale, ReplyStatus, SECOND_MS } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { ROUTING_LIST_TTL_MS, WINDOW_MS } from '../constants';
import { renderCopy } from '../inbox-copy';
import type { Message } from '../message';
import { formatChoiceOptionIds, formatRouteOptionId } from '../option-id';
import { connectionOf, createEnvironment, receive, receiveText, registerAgents } from '../testing/fixtures';
import { checkInbox } from './check-inbox';
import { expireRoutingList, findRoutingListDueAt } from './expire-routing-list';
import { sendText } from './send-text';
import { waitForReply } from './wait-for-reply';

type Environment = Awaited<ReturnType<typeof createEnvironment>>;

function routingLists(input: { environment: Environment }): Message[] {
  return input.environment.sender.sessions.filter((message) => message.kind === MessageKind.Choice);
}

function unreadTexts(input: { environment: Environment; agent: string }): Promise<(string | null)[]> {
  return checkInbox({ dependencies: input.environment.dependencies, connection: connectionOf({ agent: input.agent }) }).then(
    ({ messages }) => messages.map((message) => (message.kind === MessageKind.Text ? message.text : null)),
  );
}

function agentWrites(input: { environment: Environment; agent: string }) {
  return sendText({
    dependencies: input.environment.dependencies,
    connection: connectionOf({ agent: input.agent }),
    text: 'working',
    replyToMessageId: null,
  });
}

async function heldBatch(): Promise<{ environment: Environment; firstMessageId: string }> {
  const environment = await createEnvironment();
  await registerAgents({ environment, agents: ['alpha'] });
  await environment.clock.advance({ ms: SECOND_MS });
  await registerAgents({ environment, agents: ['beta'] });
  const first = await receiveText({ environment, text: 'first' });
  await environment.clock.advance({ ms: SECOND_MS });
  await receiveText({ environment, text: 'second' });
  return { environment, firstMessageId: first.messageId! };
}

async function expireAfterTtl(input: { environment: Environment }): Promise<void> {
  await input.environment.clock.advance({ ms: ROUTING_LIST_TTL_MS });
  await expireRoutingList({ dependencies: input.environment.dependencies });
}

describe('findRoutingListDueAt', () => {
  test('is null without a pending list', async () => {
    const environment = await createEnvironment();
    expect(await findRoutingListDueAt({ dependencies: environment.dependencies })).toBeNull();
  });

  test('is the opening time plus the routing list TTL', async () => {
    const { environment } = await heldBatch();
    const { openedAt } = (await environment.repository.findRoutingList())!;
    expect(await findRoutingListDueAt({ dependencies: environment.dependencies })).toBe(openedAt + ROUTING_LIST_TTL_MS);
  });
});

describe('expireRoutingList', () => {
  test('does nothing before the TTL', async () => {
    const { environment } = await heldBatch();
    const dueAt = await findRoutingListDueAt({ dependencies: environment.dependencies });
    await environment.clock.advance({ ms: dueAt! - environment.clock.now() - 1 });
    await expireRoutingList({ dependencies: environment.dependencies });
    expect(await environment.repository.listHeld()).toHaveLength(2);
    expect(routingLists({ environment })).toHaveLength(1);
  });

  test('delivers the held batch in order to the agent that wrote within the window and wakes its waiter', async () => {
    const { environment } = await heldBatch();
    await agentWrites({ environment, agent: 'alpha' });
    const holding = waitForReply({
      dependencies: environment.dependencies,
      connection: connectionOf({ agent: 'alpha' }),
      questionId: null,
      timeoutMs: 5 * ROUTING_LIST_TTL_MS,
    });
    await environment.clock.advance({ ms: 0 });
    await expireAfterTtl({ environment });
    expect(await holding).toMatchObject({ status: ReplyStatus.Message, messages: [{ text: 'first' }, { text: 'second' }] });
    expect(await environment.repository.listHeld()).toEqual([]);
    expect(await environment.repository.findRoutingList()).toBeNull();
    expect(routingLists({ environment })).toHaveLength(1);
  });

  test('resends the list once when no agent wrote within the window', async () => {
    const { environment, firstMessageId } = await heldBatch();
    await expireAfterTtl({ environment });
    const lists = routingLists({ environment });
    expect(lists).toHaveLength(2);
    const second = lists[1]!;
    if (second.kind !== MessageKind.Choice) throw new Error('expected a routing list');
    expect(formatChoiceOptionIds({ questionId: second.questionId, options: second.options })).toEqual([
      formatRouteOptionId({ messageId: firstMessageId, agent: 'beta' }),
      formatRouteOptionId({ messageId: firstMessageId, agent: 'alpha' }),
    ]);
    expect(await environment.repository.listHeld()).toHaveLength(2);
    expect(await environment.repository.findRoutingList()).toMatchObject({
      promptMessageId: second.messageId,
      openedAt: environment.clock.now(),
      resent: true,
    });
  });

  test('after the second expiry the batch stays unread for the last agent seen', async () => {
    const { environment } = await heldBatch();
    await environment.clock.advance({ ms: SECOND_MS });
    await registerAgents({ environment, agents: ['beta'] });
    await expireAfterTtl({ environment });
    await expireAfterTtl({ environment });
    expect(routingLists({ environment })).toHaveLength(2);
    expect(await environment.repository.listHeld()).toEqual([]);
    expect(await environment.repository.findRoutingList()).toBeNull();
    expect(await environment.repository.countUnread({ agent: 'beta' })).toBe(2);
    expect(await unreadTexts({ environment, agent: 'beta' })).toEqual(['first', 'second']);
  });

  test('an agent that wrote after the resend takes the batch at the second expiry', async () => {
    const { environment } = await heldBatch();
    await expireAfterTtl({ environment });
    await agentWrites({ environment, agent: 'alpha' });
    await expireAfterTtl({ environment });
    expect(await unreadTexts({ environment, agent: 'alpha' })).toEqual(['first', 'second']);
    expect(routingLists({ environment })).toHaveLength(2);
  });

  test('the resend is written for the locale recorded with the list', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha', 'beta'] });
    await receive({ environment, content: { kind: MessageKind.Text, text: 'oi' }, ownerLocale: OwnerLocale.PortugueseBrazil });
    await expireAfterTtl({ environment });
    expect(await environment.repository.findRoutingList()).toMatchObject({ locale: OwnerLocale.PortugueseBrazil });
  });

  test('a list with nothing held is closed', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    await environment.repository.saveRoutingList({
      routingList: {
        promptMessageId: 'msg_gone',
        openedAt: environment.clock.now(),
        locale: OwnerLocale.EnglishUs,
        resent: false,
        reminded: false,
      },
    });
    await expireAfterTtl({ environment });
    expect(await environment.repository.findRoutingList()).toBeNull();
    expect(routingLists({ environment })).toEqual([]);
  });

  test('the window of rule 5 is counted back from the expiry', async () => {
    const { environment } = await heldBatch();
    await agentWrites({ environment, agent: 'alpha' });
    await environment.clock.advance({ ms: WINDOW_MS + 1 });
    await expireRoutingList({ dependencies: environment.dependencies });
    expect(await environment.repository.findRoutingList()).toMatchObject({ resent: true });
    expect(await environment.repository.listHeld()).toHaveLength(2);
  });

  test('the owner is told which agent got a batch assigned by expiry, not that it is not listening', async () => {
    const { environment } = await heldBatch();
    await agentWrites({ environment, agent: 'alpha' });
    await expireAfterTtl({ environment });
    const texts = environment.sender.sessions.flatMap((message) => (message.kind === MessageKind.Text ? [message.text] : []));
    expect(texts.at(-1)).toBe(
      renderCopy({ key: InboxCopyKey.AgentAssignedByExpiry, locale: OwnerLocale.EnglishUs, values: { agent: 'alpha' } }),
    );
  });

  test('a resend that fails to send still moves the due time forward and the next expiry assigns the batch', async () => {
    const { environment } = await heldBatch();
    environment.sender.failSessionCalls({ callNumbers: [3] });
    await environment.clock.advance({ ms: ROUTING_LIST_TTL_MS });
    await expect(expireRoutingList({ dependencies: environment.dependencies })).rejects.toThrow();
    const dueAt = await findRoutingListDueAt({ dependencies: environment.dependencies });
    expect(dueAt).toBeGreaterThan(environment.clock.now());
    await expireAfterTtl({ environment });
    expect(await environment.repository.listHeld()).toEqual([]);
    expect(await unreadTexts({ environment, agent: 'beta' })).toEqual(['first', 'second']);
    expect(routingLists({ environment })).toHaveLength(1);
  });

  test('two expiries running at once send one resend', async () => {
    const { environment } = await heldBatch();
    await environment.clock.advance({ ms: ROUTING_LIST_TTL_MS });
    await Promise.all([
      expireRoutingList({ dependencies: environment.dependencies }),
      expireRoutingList({ dependencies: environment.dependencies }),
    ]);
    expect(routingLists({ environment })).toHaveLength(2);
  });
});
