import { AccountReplyIntent, AccountReplyParameter } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { addAgent, createAccountFixture, intentsOf, ownerInputOf, PUBLIC_ORIGIN } from '../testing/fixtures';
import { rotateAgentConnection } from './rotate-agent-connection';

describe('rotateAgentConnection', () => {
  test('replaces the digest at once and replies with the new prompt', async () => {
    const fixture = await createAccountFixture();
    const oldDigest = await addAgent({ ...fixture, agent: 'claude' });
    const result = await rotateAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
    const [issued] = fixture.environment.secrets.issued.slice(-1);
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.Rotated]);
    expect(result.replies[0]!.parameters[AccountReplyParameter.InstallPrompt]).toContain(`${PUBLIC_ORIGIN}/c/${issued!.secret}/mcp`);
    expect(await fixture.environment.connectionDirectory.resolveSecretDigest({ secretDigest: oldDigest })).toBeNull();
    expect(await fixture.environment.connectionDirectory.resolveSecretDigest({ secretDigest: issued!.digest })).not.toBeNull();
    expect(result.compensation).toMatchObject({ agent: 'claude', oldDigest, newDigest: issued!.digest });
  });

  test('a revoked agent is not found and its digest is unchanged', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'claude' });
    await fixture.environment.registry.revoke({ accountId: fixture.account.accountId, agent: 'claude', revokedAt: 1 });
    const result = await rotateAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.NotFound]);
    expect(result.compensation).toBeNull();
  });

  test('an empty name replies with usage', async () => {
    const fixture = await createAccountFixture();
    const result = await rotateAgentConnection({ ...ownerInputOf(fixture), rawName: '  ' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.Usage]);
  });

  test('a lost compare-and-set race replies not found and keeps the winner digest', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'claude' });
    const losing = {
      ...fixture.environment.registry,
      rotate: async () => false,
    };
    const dependencies = { ...fixture.environment.dependencies, connections: losing };
    const result = await rotateAgentConnection({ ...ownerInputOf(fixture), dependencies, rawName: 'claude' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.NotFound]);
    expect(result.compensation).toBeNull();
  });

  test('keeps the wake setting and does not record a revocation', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'claude' });
    fixture.environment.revocations.wakeConfigured.add('claude');
    await rotateAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
    expect(fixture.environment.revocations.revoked).toEqual([]);
    expect(fixture.environment.revocations.wakeConfigured.has('claude')).toBe(true);
  });
});
