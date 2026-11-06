import { DeliveryState, InboxErrorCode, MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { captureInboxError } from '../testing/capture-inbox-error';
import { connectionOf, createEnvironment, receiveText } from '../testing/fixtures';
import { react } from './react';

const alpha = connectionOf({ agent: 'alpha' });

async function ownerMessageId(input: { environment: Awaited<ReturnType<typeof createEnvironment>> }): Promise<string> {
  const { messageId } = await receiveText({ environment: input.environment, text: 'oi' });
  if (messageId === null) throw new Error('expected a stored owner message');
  return messageId;
}

describe('react', () => {
  test('CU-156 reacts to an owner message', async () => {
    const environment = await createEnvironment();
    const targetMessageId = await ownerMessageId({ environment });
    const result = await react({ dependencies: environment.dependencies, connection: alpha, targetMessageId, emoji: '👍' });
    expect(result.delivery).toBe(DeliveryState.Sent);
    expect(await environment.repository.findMessage({ messageId: result.messageId })).toMatchObject({
      kind: MessageKind.Reaction,
      targetMessageId,
      emoji: '👍',
      delivery: DeliveryState.Sent,
    });
  });

  test('CU-157 an empty emoji removes the reaction', async () => {
    const environment = await createEnvironment();
    const targetMessageId = await ownerMessageId({ environment });
    const result = await react({ dependencies: environment.dependencies, connection: alpha, targetMessageId, emoji: null });
    expect(await environment.repository.findMessage({ messageId: result.messageId })).toMatchObject({
      kind: MessageKind.Reaction,
      emoji: null,
    });
  });

  test('CU-158 an unknown target is rejected', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() =>
      react({ dependencies: environment.dependencies, connection: alpha, targetMessageId: 'msg_missing', emoji: '👍' }),
    );
    expect(error).toEqual({ code: InboxErrorCode.NotFound, message: 'message_id: message not found' });
  });

  test('a letter is not an emoji', async () => {
    const environment = await createEnvironment();
    const targetMessageId = await ownerMessageId({ environment });
    const error = await captureInboxError(() =>
      react({ dependencies: environment.dependencies, connection: alpha, targetMessageId, emoji: 'a' }),
    );
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'emoji: must be one emoji' });
  });
});
