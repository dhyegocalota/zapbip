import { SECOND_MS } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { createEnvironment, receiveText, START_AT } from '../testing/fixtures';
import { touchAgent } from './touch-agent';

describe('touchAgent', () => {
  test('registers the agent and moves its last seen time forward', async () => {
    const environment = await createEnvironment();
    await touchAgent({ dependencies: environment.dependencies, agent: 'alpha' });
    await environment.clock.advance({ ms: SECOND_MS });
    await touchAgent({ dependencies: environment.dependencies, agent: 'alpha' });
    expect(await environment.repository.listAgents()).toEqual([{ agent: 'alpha', lastSeenAt: START_AT + SECOND_MS }]);
  });

  test('CU-191 the first agent takes the messages held with no agents and a second agent takes none', async () => {
    const environment = await createEnvironment();
    await receiveText({ environment, text: 'um' });
    await receiveText({ environment, text: 'dois' });
    await touchAgent({ dependencies: environment.dependencies, agent: 'alpha' });
    expect((await environment.repository.listUnread({ agent: 'alpha', limit: 10 })).map((message) => message.messageId)).toHaveLength(2);
    expect(await environment.repository.listHeld()).toEqual([]);
    await receiveText({ environment, text: 'tres' });
    await touchAgent({ dependencies: environment.dependencies, agent: 'beta' });
    expect(await environment.repository.listUnread({ agent: 'beta', limit: 10 })).toEqual([]);
  });
});
