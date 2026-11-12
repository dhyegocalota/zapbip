import { InstallClient } from '@zapbip/agents/install';
import { describe, expect, it } from 'vitest';
import { siteAgentIdOf, siteAgents, siteAgentNames } from '../../src/site/site-agents';

const [FIRST_ID, SECOND_ID] = Object.values(InstallClient) as [string, string];

describe('site agents', () => {
  it.each(Object.values(InstallClient))('accepts the install facet id %s', (id) => {
    expect(siteAgentIdOf({ value: id })).toBe(id);
  });

  it.each([undefined, '', 'nope', '__proto__', 'constructor', FIRST_ID.toUpperCase(), ` ${FIRST_ID}`, `${FIRST_ID},${SECOND_ID}`])(
    'refuses %j',
    (value) => {
      expect(siteAgentIdOf({ value })).toBeNull();
    },
  );

  it('lists the agents in the order of the names', () => {
    expect(siteAgents().map((agent) => agent.name)).toEqual(siteAgentNames());
    expect(siteAgents().map((agent) => agent.id)).toEqual(Object.values(InstallClient));
  });
});
