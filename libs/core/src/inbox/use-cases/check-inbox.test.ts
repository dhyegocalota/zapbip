import { InboxStatus } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { connectionOf, createEnvironment, receiveText, registerAgents } from '../testing/fixtures';
import { checkInbox } from './check-inbox';

function check(input: { environment: Awaited<ReturnType<typeof createEnvironment>> }) {
  return checkInbox({ dependencies: input.environment.dependencies, connection: connectionOf({ agent: 'alpha' }) });
}

describe('checkInbox', () => {
  test('CU-125 an empty inbox', async () => {
    const environment = await createEnvironment();
    expect(await check({ environment })).toEqual({ status: InboxStatus.Empty, messages: [] });
  });

  test('returns new messages once and marks them read', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    await receiveText({ environment, text: '@alpha hi' });
    const first = await check({ environment });
    expect(first).toMatchObject({ status: InboxStatus.New, messages: [{ text: 'hi', readByAgent: true }] });
    expect(await check({ environment })).toEqual({ status: InboxStatus.Empty, messages: [] });
  });

  test('CU-126 caps at the history limit and leaves the rest unread', async () => {
    const environment = await createEnvironment();
    await registerAgents({ environment, agents: ['alpha'] });
    await Array.from({ length: 25 }, (_, index) => index).reduce(
      (previous, number) => previous.then(() => receiveText({ environment, text: `@alpha ${number}` }).then(() => undefined)),
      Promise.resolve(),
    );
    const result = await check({ environment });
    expect(result.status).toBe(InboxStatus.New);
    expect(result.messages).toHaveLength(20);
    expect(await environment.repository.countUnread({ agent: 'alpha' })).toBe(5);
  });
});
