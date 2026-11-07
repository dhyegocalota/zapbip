import { ChannelErrorKind, DeliveryState, MessageKind, OwnerLocale, TemplateKind, WakeOutcome } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { NOTICE_FAILED_MESSAGE } from '../constants';
import { channelError } from '../testing/channel-fixtures';
import { captureInboxError } from '../testing/capture-inbox-error';
import {
  askAndAbandon,
  closeWindow as closeWindowFixture,
  connectionOf,
  createEnvironment,
  receiveText,
  registerAgents,
} from '../testing/fixtures';
import { react } from './react';
import { sendText } from './send-text';

type Environment = Awaited<ReturnType<typeof createEnvironment>>;

function send(input: { environment: Environment; text: string; replyToMessageId?: string | null; ownerLocale?: OwnerLocale }) {
  const { environment, text, replyToMessageId = null, ownerLocale } = input;
  return sendText({
    dependencies: environment.dependencies,
    connection: connectionOf({ agent: 'alpha', ownerLocale }),
    text,
    replyToMessageId,
  });
}

async function ownerMessageIn(input: { environment: Environment }): Promise<string> {
  const { environment } = input;
  await registerAgents({ environment, agents: ['alpha'] });
  environment.waker.replyWith({ outcome: WakeOutcome.Woken });
  const { messageId } = await receiveText({ environment, text: '@alpha oi' });
  if (messageId === null) throw new Error('expected a stored owner message');
  return messageId;
}

async function historyOf(input: { environment: Environment }) {
  return input.environment.repository.listAgentHistory({ agent: 'alpha', limit: 20 });
}

describe('deliverToOwner with the channel', () => {
  test('CU-32 a sent message keeps the channel id the sender returned', async () => {
    const environment = await createEnvironment();
    const result = await send({ environment, text: 'hi' });
    expect(result.delivery).toBe(DeliveryState.Sent);
    expect(await environment.repository.findChannelMessageId({ messageId: result.messageId })).toBe('wamid.session.1');
  });

  test('CU-33 a window the channel reports closed queues the message and sends one notice', async () => {
    const environment = await createEnvironment();
    environment.sender.failSessionCalls({
      callNumbers: [1],
      error: channelError({ kind: ChannelErrorKind.WindowClosed, errorCode: 131047 }),
    });
    const first = await send({ environment, text: 'one' });
    const second = await send({ environment, text: 'two' });
    expect(first.delivery).toBe(DeliveryState.Queued);
    expect(second.delivery).toBe(DeliveryState.Queued);
    expect((await environment.repository.findWindow()).closedAt).not.toBeNull();
    expect(environment.sender.sessionRequests).toHaveLength(1);
    expect(environment.sender.templates).toHaveLength(1);
  });

  test('CU-34 a rate limit fails the message and the agent reads the channel text', async () => {
    const environment = await createEnvironment();
    environment.sender.failSessionCalls({
      callNumbers: [1],
      error: channelError({ kind: ChannelErrorKind.RateLimited, message: 'busy text', errorCode: 130429 }),
    });
    const error = await captureInboxError(() => send({ environment, text: 'hi' }));
    expect(error).toEqual({ code: ChannelErrorKind.RateLimited, message: 'busy text' });
    const [stored] = await historyOf({ environment });
    expect(stored).toMatchObject({ delivery: DeliveryState.Failed });
    expect(environment.repository.findStatusDetail({ messageId: stored!.messageId })).toMatchObject({ errorCode: 130429 });
  });

  test('a sender error that is not a channel error stays a delivery failure', async () => {
    const environment = await createEnvironment();
    environment.sender.failSessionCalls({ callNumbers: [1] });
    const error = await captureInboxError(() => send({ environment, text: 'hi' }));
    expect(error).toEqual({ code: ChannelErrorKind.DeliveryFailed, message: 'delivery failed for text' });
  });

  test('CU-35 a rejected reaction names the field', async () => {
    const environment = await createEnvironment();
    const targetMessageId = await ownerMessageIn({ environment });
    environment.sender.failSessionCalls({
      callNumbers: [1],
      error: channelError({
        kind: ChannelErrorKind.ReactionRejected,
        message: 'Reaction target invalid: reaction.message_id',
        errorCode: 131009,
      }),
    });
    const error = await captureInboxError(() =>
      react({
        dependencies: environment.dependencies,
        connection: connectionOf({ agent: 'alpha' }),
        targetMessageId,
        emoji: '👍',
      }),
    );
    expect(error.message).toContain('reaction.message_id');
    const stored = (await historyOf({ environment })).find((message) => message.kind === MessageKind.Reaction);
    expect(stored).toMatchObject({ delivery: DeliveryState.Failed });
  });

  test('CU-36 a reply reaches the sender as the channel id of its target', async () => {
    const environment = await createEnvironment();
    const first = await send({ environment, text: 'one' });
    await send({ environment, text: 'two', replyToMessageId: first.messageId });
    expect(environment.sender.sessionRequests[1]).toMatchObject({ replyToChannelMessageId: 'wamid.session.1' });
    expect(environment.sender.sessionRequests[0]).toMatchObject({ replyToChannelMessageId: null });
  });

  test('CU-37 a reaction reaches the sender as the channel id of its target', async () => {
    const environment = await createEnvironment();
    const messageId = await ownerMessageIn({ environment });
    await react({
      dependencies: environment.dependencies,
      connection: connectionOf({ agent: 'alpha' }),
      targetMessageId: messageId,
      emoji: '👍',
    });
    const channelMessageId = await environment.repository.findChannelMessageId({ messageId });
    expect(channelMessageId).not.toBeNull();
    expect(environment.sender.sessionRequests[0]).toMatchObject({ reactionTargetChannelMessageId: channelMessageId });
  });

  test('CU-42 a reaction whose target has no channel id is refused before the sender', async () => {
    const environment = await createEnvironment();
    const first = await send({ environment, text: 'one' });
    environment.sender.sessionRequests.length = 0;
    const withoutChannelId = { ...(await environment.repository.findMessage({ messageId: first.messageId }))!, messageId: 'msg_nochannel' };
    await environment.repository.insertMessage({ message: withoutChannelId });
    const error = await captureInboxError(() =>
      react({
        dependencies: environment.dependencies,
        connection: connectionOf({ agent: 'alpha' }),
        targetMessageId: 'msg_nochannel',
        emoji: '👍',
      }),
    );
    expect(error.code).toBe(ChannelErrorKind.ReactionRejected);
    expect(error.message).toContain('reaction.message_id');
    expect(environment.sender.sessionRequests).toEqual([]);
  });

  test('a question reaches the sender with its stored question', async () => {
    const environment = await createEnvironment();
    const question = await askAndAbandon({ environment });
    expect(environment.sender.sessionRequests[0]).toMatchObject({ question: { questionId: question.questionId } });
  });

  test('CU-43 the notice template carries the owner locale', async () => {
    const environment = await createEnvironment();
    await closeWindowFixture({ environment });
    await send({ environment, text: 'hi', ownerLocale: OwnerLocale.EnglishUs });
    expect(environment.sender.templates).toMatchObject([{ kind: TemplateKind.Notice, locale: OwnerLocale.EnglishUs }]);
  });

  test('a notice the channel rejects leaves the message queued and the agent reads the notice failure text', async () => {
    const environment = await createEnvironment();
    await closeWindowFixture({ environment });
    environment.sender.failTemplateCalls({
      callNumbers: [1],
      error: channelError({ kind: ChannelErrorKind.TemplateRejected, message: 'template not approved', errorCode: 132001 }),
    });
    const error = await captureInboxError(() => send({ environment, text: 'hi' }));
    expect(error).toEqual({ code: ChannelErrorKind.DeliveryFailed, message: NOTICE_FAILED_MESSAGE });
    expect((await environment.repository.findWindow()).noticeSentForClosedWindow).toBe(false);
  });

  test('a window the channel reports closed with a rejected notice leaves the message queued and the agent reads the notice failure text', async () => {
    const environment = await createEnvironment();
    environment.sender.failSessionCalls({
      callNumbers: [1],
      error: channelError({ kind: ChannelErrorKind.WindowClosed, errorCode: 131047 }),
    });
    environment.sender.failTemplateCalls({
      callNumbers: [1],
      error: channelError({ kind: ChannelErrorKind.TemplateRejected, message: 'template not approved', errorCode: 132001 }),
    });
    const error = await captureInboxError(() => send({ environment, text: 'hi' }));
    expect(error).toEqual({ code: ChannelErrorKind.DeliveryFailed, message: NOTICE_FAILED_MESSAGE });
    const [stored] = await historyOf({ environment });
    expect(stored).toMatchObject({ delivery: DeliveryState.Queued });
  });

  test('a failed message does not read the notice failure of a later queued message', async () => {
    const environment = await createEnvironment();
    environment.sender.failSessionCalls({
      callNumbers: [1],
      error: channelError({ kind: ChannelErrorKind.RateLimited, message: 'busy text', errorCode: 130429 }),
    });
    environment.sender.failSessionCalls({
      callNumbers: [2],
      error: channelError({ kind: ChannelErrorKind.WindowClosed, errorCode: 131047 }),
    });
    environment.sender.failTemplateCalls({
      callNumbers: [1],
      error: channelError({ kind: ChannelErrorKind.TemplateRejected, message: 'template not approved', errorCode: 132001 }),
    });
    const [failed] = await Promise.all([captureInboxError(() => send({ environment, text: 'one' })), send({ environment, text: 'two' })]);
    expect(failed).toEqual({ code: ChannelErrorKind.RateLimited, message: 'busy text' });
  });
});
