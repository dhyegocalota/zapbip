import { MessageDirection, MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { Message } from '../message';
import { connectionOf, createEnvironment, receiveText, registerAgents } from '../testing/fixtures';
import { sendText } from './send-text';

type Environment = Awaited<ReturnType<typeof createEnvironment>>;

function reply(input: { environment: Environment; replyToMessageId: string }) {
  return sendText({
    dependencies: input.environment.dependencies,
    connection: connectionOf({ agent: 'grok-bot' }),
    text: 'done',
    replyToMessageId: input.replyToMessageId,
  });
}

function handoffCopyOf(input: { originMessageId: string }): Message {
  return {
    messageId: 'copy_1',
    direction: MessageDirection.FromOwner,
    agent: 'grok-bot',
    at: 0,
    replyToMessageId: null,
    delivery: null,
    readByAgent: false,
    forwarded: false,
    handedTo: null,
    originMessageId: input.originMessageId,
    kind: MessageKind.Text,
    text: 'hi',
  };
}

describe('sendContent reply_to', () => {
  test('a reply to a primary message keeps its id', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['grok-bot'] });
    const received = await receiveText({ environment, text: '@grok-bot hi' });
    const sent = await reply({ environment, replyToMessageId: received.messageId! });
    expect(await environment.repository.findMessage({ messageId: sent.messageId })).toMatchObject({ replyToMessageId: received.messageId });
  });

  test('a reply to a handoff copy points at the owner message the copy copies', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['grok-bot'] });
    await environment.repository.insertMessage({ message: handoffCopyOf({ originMessageId: 'owner_message_1' }) });
    const sent = await reply({ environment, replyToMessageId: 'copy_1' });
    expect(await environment.repository.findMessage({ messageId: sent.messageId })).toMatchObject({ replyToMessageId: 'owner_message_1' });
  });
});
