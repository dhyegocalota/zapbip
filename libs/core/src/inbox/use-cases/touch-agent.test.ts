import { SECOND_MS } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { createEnvironment, START_AT } from '../testing/fixtures';
import { touchAgent } from './touch-agent';

describe('touchAgent', () => {
  test('registers the agent and moves its last seen time forward', async () => {
    const environment = await createEnvironment();
    await touchAgent({ dependencies: environment.dependencies, agent: 'alpha' });
    await environment.clock.advance({ ms: SECOND_MS });
    await touchAgent({ dependencies: environment.dependencies, agent: 'alpha' });
    expect(await environment.repository.listAgents()).toEqual([{ agent: 'alpha', lastSeenAt: START_AT + SECOND_MS }]);
  });
});
