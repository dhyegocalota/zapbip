import { AccountReplyIntent, AccountReplyParameter, INSTALL_CODE_TTL_MS, InstallCodeStatus } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { addAgent, createAccountFixture, intentsOf, ownerInputOf, PUBLIC_ORIGIN } from '../testing/fixtures';
import { rotateAgentConnection } from './rotate-agent-connection';

describe('rotateAgentConnection', () => {
  test('replaces the digest at once and replies with the new install link only', async () => {
    const fixture = await createAccountFixture();
    const oldDigest = await addAgent({ ...fixture, agent: 'claude' });
    const result = await rotateAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
    const [issued] = fixture.environment.secrets.issued.slice(-1);
    const [installCode] = fixture.environment.installCodeVault.issued.slice(-1);
    const installPrompt = result.replies[0]!.parameters[AccountReplyParameter.InstallPrompt]!;
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.Rotated]);
    expect(installPrompt).toContain(`${PUBLIC_ORIGIN}/i/${installCode!.installCode}`);
    expect(installPrompt).not.toContain('/c/');
    expect(installPrompt).not.toContain(issued!.secret);
    expect(await fixture.environment.connectionDirectory.resolveSecretDigest({ secretDigest: oldDigest })).toBeNull();
    expect(await fixture.environment.connectionDirectory.resolveSecretDigest({ secretDigest: issued!.digest })).not.toBeNull();
    expect(result.compensation).toMatchObject({ agent: 'claude', oldDigest, newDigest: issued!.digest });
  });

  test('replaces the install code and keeps the previous columns for the compensation', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'claude' });
    const before = await fixture.environment.registry.findActiveByAgent({ accountId: fixture.account.accountId, agent: 'claude' });
    const result = await rotateAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
    const [installCode] = fixture.environment.installCodeVault.issued.slice(-1);
    const after = await fixture.environment.registry.findActiveByAgent({ accountId: fixture.account.accountId, agent: 'claude' });
    expect(after!.installCodeDigest).toBe(installCode!.digest);
    expect(after!.installCodeExpiresAt).toBe(fixture.environment.clock.now() + INSTALL_CODE_TTL_MS);
    expect(result.compensation!.oldInstallCode).toEqual({
      installCodeDigest: before!.installCodeDigest,
      installCodeSealedSecret: before!.installCodeSealedSecret,
      installCodeExpiresAt: before!.installCodeExpiresAt,
    });
  });

  test('a rotated used connection is ready again under the new code', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'claude' });
    await rotateAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
    const [firstCode] = fixture.environment.installCodeVault.issued.slice(-1);
    const [active] = await fixture.environment.registry.listActive({ accountId: fixture.account.accountId });
    await fixture.environment.installCodeDirectory.recordFirstCall({ connectionId: active!.connectionId, calledAt: 1 });
    await rotateAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
    const [secondCode] = fixture.environment.installCodeVault.issued.slice(-1);
    const now = fixture.environment.clock.now();
    expect((await fixture.environment.installCodeDirectory.resolve({ installCode: firstCode!.installCode, now })).status).toBe(
      InstallCodeStatus.Unknown,
    );
    expect((await fixture.environment.installCodeDirectory.resolve({ installCode: secondCode!.installCode, now })).status).toBe(
      InstallCodeStatus.Ready,
    );
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
