import { AccountReplyIntent } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { addAgent, createAccountFixture, intentsOf, ownerInputOf } from '../testing/fixtures';
import { revokeAgentConnection } from './revoke-agent-connection';

describe('revokeAgentConnection', () => {
  test('revokes an active agent now and its digest stops resolving', async () => {
    const fixture = await createAccountFixture();
    const digest = await addAgent({ ...fixture, agent: 'claude' });
    const result = await revokeAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.Revoked]);
    expect(await fixture.environment.connectionDirectory.resolveSecretDigest({ secretDigest: digest })).toBeNull();
    const [row] = fixture.environment.registry.listAll({ accountId: fixture.account.accountId });
    expect(row!.revokedAt).toBe(fixture.environment.clock.now());
  });

  test('an already revoked agent is not found and keeps its revocation time', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'claude' });
    await fixture.environment.registry.revoke({ accountId: fixture.account.accountId, agent: 'claude', revokedAt: 5 });
    const result = await revokeAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.NotFound]);
    expect(fixture.environment.registry.listAll({ accountId: fixture.account.accountId })[0]!.revokedAt).toBe(5);
  });

  test.each([{ rawName: 'nope' }, { rawName: 'agentes' }])('$rawName is not found', async ({ rawName }) => {
    const fixture = await createAccountFixture();
    const result = await revokeAgentConnection({ ...ownerInputOf(fixture), rawName });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.NotFound]);
    expect(fixture.environment.revocations.revoked).toEqual([]);
  });

  test('the name is normalised', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'agent-one' });
    const result = await revokeAgentConnection({ ...ownerInputOf(fixture), rawName: 'Agent One' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.Revoked]);
  });

  test('an empty name replies with usage', async () => {
    const fixture = await createAccountFixture();
    const result = await revokeAgentConnection({ ...ownerInputOf(fixture), rawName: '' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.Usage]);
  });

  test('records the revocation once, clears the wake state and never cancels as a rotate', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'claude' });
    fixture.environment.revocations.wakeConfigured.add('claude');
    await revokeAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
    expect(fixture.environment.revocations.revoked).toEqual(['claude']);
    expect(fixture.environment.revocations.cancelled).toEqual([]);
    expect(fixture.environment.revocations.wakeConfigured.has('claude')).toBe(false);
  });
});
