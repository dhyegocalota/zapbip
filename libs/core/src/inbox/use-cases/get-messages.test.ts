import { InboxErrorCode } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { captureInboxError } from '../testing/capture-inbox-error';
import { connectionOf, createEnvironment, receiveText, registerAgents } from '../testing/fixtures';
import { getMessages } from './get-messages';

type Environment = Awaited<ReturnType<typeof createEnvironment>>;

async function environmentWithUnread(input: { count: number }): Promise<Environment> {
  const environment = await createEnvironment();
  await registerAgents({ environment, agents: ['alpha'] });
  await Array.from({ length: input.count }, (_, index) => index + 1).reduce(
    (previous, number) => previous.then(() => receiveText({ environment, text: `@alpha ${number}` }).then(() => undefined)),
    Promise.resolve(),
  );
  return environment;
}

function read(input: { environment: Environment; limit: number }) {
  return getMessages({ dependencies: input.environment.dependencies, connection: connectionOf({ agent: 'alpha' }), limit: input.limit });
}

function texts(messages: unknown[]): unknown[] {
  return messages.map((message) => (message as { text: string }).text);
}

describe('getMessages', () => {
  test('CU-121 returns the oldest unread up to the limit and the last exchanged messages', async () => {
    const environment = await environmentWithUnread({ count: 8 });
    const result = await read({ environment, limit: 5 });
    expect(texts(result.unread)).toEqual(['1', '2', '3', '4', '5']);
    expect(texts(result.history)).toEqual(['4', '5', '6', '7', '8']);
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(3);
  });

  test('CU-122 marks the unread as read and keeps them in the history', async () => {
    const environment = await environmentWithUnread({ count: 2 });
    await read({ environment, limit: 5 });
    const second = await read({ environment, limit: 5 });
    expect(second.unread).toEqual([]);
    expect(texts(second.history)).toEqual(['1', '2']);
  });

  test('CU-123 limit zero', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() => read({ environment, limit: 0 }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'limit: must be between 1 and 20' });
  });

  test('CU-124 limit above the history cap', async () => {
    const environment = await createEnvironment();
    const error = await captureInboxError(() => read({ environment, limit: 21 }));
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'limit: must be between 1 and 20' });
  });
});
