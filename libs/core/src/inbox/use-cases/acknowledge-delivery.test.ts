import { MessageDirection, MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import type { Message } from '../message';
import { createEnvironment } from '../testing/fixtures';
import { acknowledgeDelivery } from './acknowledge-delivery';

type Environment = Awaited<ReturnType<typeof createEnvironment>>;

function textMessage(input: { messageId: string; agent: string; direction: MessageDirection }): Message {
  return {
    messageId: input.messageId,
    direction: input.direction,
    agent: input.agent,
    at: 1,
    replyToMessageId: null,
    delivery: null,
    readByAgent: false,
    kind: MessageKind.Text,
    text: 'hello',
  };
}

async function readFlagOf(input: { environment: Environment; messageId: string }): Promise<boolean | null> {
  const message = await input.environment.repository.findMessage({ messageId: input.messageId });
  return message === null ? null : message.readByAgent;
}

describe('acknowledgeDelivery', () => {
  test('marks an owner message of the agent as read', async () => {
    const environment = await createEnvironment();
    await environment.repository.insertMessage({
      message: textMessage({ messageId: 'msg_1', agent: 'ana', direction: MessageDirection.FromOwner }),
    });
    await acknowledgeDelivery({ dependencies: environment.dependencies, agent: 'ana', messageId: 'msg_1' });
    expect(await readFlagOf({ environment, messageId: 'msg_1' })).toBe(true);
  });

  test('leaves a message of another agent unread', async () => {
    const environment = await createEnvironment();
    await environment.repository.insertMessage({
      message: textMessage({ messageId: 'msg_2', agent: 'bruno', direction: MessageDirection.FromOwner }),
    });
    await acknowledgeDelivery({ dependencies: environment.dependencies, agent: 'ana', messageId: 'msg_2' });
    expect(await readFlagOf({ environment, messageId: 'msg_2' })).toBe(false);
  });

  test('leaves an agent message unread', async () => {
    const environment = await createEnvironment();
    await environment.repository.insertMessage({
      message: textMessage({ messageId: 'msg_3', agent: 'ana', direction: MessageDirection.ToOwner }),
    });
    await acknowledgeDelivery({ dependencies: environment.dependencies, agent: 'ana', messageId: 'msg_3' });
    expect(await readFlagOf({ environment, messageId: 'msg_3' })).toBe(false);
  });

  test('ignores an unknown message id without an error', async () => {
    const environment = await createEnvironment();
    await expect(
      acknowledgeDelivery({ dependencies: environment.dependencies, agent: 'ana', messageId: 'msg_404' }),
    ).resolves.toBeUndefined();
  });

  test('acknowledging twice keeps the message read', async () => {
    const environment = await createEnvironment();
    await environment.repository.insertMessage({
      message: textMessage({ messageId: 'msg_4', agent: 'ana', direction: MessageDirection.FromOwner }),
    });
    await acknowledgeDelivery({ dependencies: environment.dependencies, agent: 'ana', messageId: 'msg_4' });
    await acknowledgeDelivery({ dependencies: environment.dependencies, agent: 'ana', messageId: 'msg_4' });
    expect(await readFlagOf({ environment, messageId: 'msg_4' })).toBe(true);
  });

  test('leaves other unread messages of the agent unread', async () => {
    const environment = await createEnvironment();
    await environment.repository.insertMessage({
      message: textMessage({ messageId: 'msg_5', agent: 'ana', direction: MessageDirection.FromOwner }),
    });
    await environment.repository.insertMessage({
      message: textMessage({ messageId: 'msg_6', agent: 'ana', direction: MessageDirection.FromOwner }),
    });
    await acknowledgeDelivery({ dependencies: environment.dependencies, agent: 'ana', messageId: 'msg_5' });
    expect(await readFlagOf({ environment, messageId: 'msg_6' })).toBe(false);
  });
});
