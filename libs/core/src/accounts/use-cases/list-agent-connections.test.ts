import { AccountReplyIntent, AccountReplyParameter } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { addAgent, createAccountFixture, intentsOf, ownerInputOf } from '../testing/fixtures';
import { listAgentConnections } from './list-agent-connections';

const SECRET_PATTERN = /zb_conn_|[0-9a-f]{64}/;

describe('listAgentConnections', () => {
  test('no agents replies with the empty list', async () => {
    const fixture = await createAccountFixture();
    const result = await listAgentConnections(ownerInputOf(fixture));
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.EmptyList]);
  });

  test('lists the active agents with their dates and never a secret or digest', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'a1' });
    await addAgent({ ...fixture, agent: 'b2' });
    await addAgent({ ...fixture, agent: 'c3' });
    await fixture.environment.registry.revoke({ accountId: fixture.account.accountId, agent: 'c3', revokedAt: 1 });
    const result = await listAgentConnections(ownerInputOf(fixture));
    const agents = result.replies[0]!.parameters[AccountReplyParameter.Agents]!;
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.Listed]);
    expect(agents).toContain('a1');
    expect(agents).toContain('b2');
    expect(agents).not.toContain('c3');
    expect(agents).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(Object.values(result.replies[0]!.parameters).some((value) => SECRET_PATTERN.test(value))).toBe(false);
  });
});
