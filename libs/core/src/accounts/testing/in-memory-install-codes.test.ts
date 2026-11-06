import { InstallCodeStatus } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { INSTALL_CODE_TTL_MS } from '../constants';
import { createAgentConnection } from '../use-cases/create-agent-connection';
import { rotateAgentConnection } from '../use-cases/rotate-agent-connection';
import { createAccountFixture, ownerInputOf, PUBLIC_ORIGIN } from './fixtures';

async function createdFixture() {
  const fixture = await createAccountFixture();
  await createAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
  const [installCode] = fixture.environment.installCodeVault.issued;
  const [secret] = fixture.environment.secrets.issued;
  const [connection] = await fixture.environment.registry.listActive({ accountId: fixture.account.accountId });
  return { fixture, installCode: installCode!.installCode, secret: secret!.secret, connection: connection! };
}

describe('the in-memory install code directory', () => {
  test('a fresh code is ready with the connection link, the agent and the account locale', async () => {
    const { fixture, installCode, secret, connection } = await createdFixture();
    const resolution = await fixture.environment.installCodeDirectory.resolve({ installCode, now: fixture.environment.clock.now() });
    expect(resolution).toEqual({
      status: InstallCodeStatus.Ready,
      connectionLink: `${PUBLIC_ORIGIN}/c/${secret}/mcp`,
      locale: fixture.account.locale,
      agent: 'claude',
      accountId: fixture.account.accountId,
      connectionId: connection.connectionId,
    });
  });

  test('an unknown code is unknown with no locale', async () => {
    const { fixture } = await createdFixture();
    const resolution = await fixture.environment.installCodeDirectory.resolve({ installCode: 'zb_inst_other', now: 0 });
    expect(resolution).toEqual({ status: InstallCodeStatus.Unknown, locale: null });
  });

  test('a code at its expiry is expired', async () => {
    const { fixture, installCode } = await createdFixture();
    const now = fixture.environment.clock.now() + INSTALL_CODE_TTL_MS;
    const resolution = await fixture.environment.installCodeDirectory.resolve({ installCode, now });
    expect(resolution).toEqual({ status: InstallCodeStatus.Expired, locale: fixture.account.locale });
  });

  test('a code is used after the first call and the call is recorded once', async () => {
    const { fixture, installCode, connection } = await createdFixture();
    const { installCodeDirectory } = fixture.environment;
    await installCodeDirectory.recordFirstCall({ connectionId: connection.connectionId, calledAt: 10 });
    await installCodeDirectory.recordFirstCall({ connectionId: connection.connectionId, calledAt: 20 });
    const [stored] = await fixture.environment.registry.listActive({ accountId: fixture.account.accountId });
    expect(stored!.firstCallAt).toBe(10);
    expect(stored!.installCodeSealedSecret).toBeNull();
    const resolution = await installCodeDirectory.resolve({ installCode, now: fixture.environment.clock.now() });
    expect(resolution).toEqual({ status: InstallCodeStatus.Used, locale: fixture.account.locale });
  });

  test('a revoked connection is unknown', async () => {
    const { fixture, installCode } = await createdFixture();
    await fixture.environment.registry.revoke({ accountId: fixture.account.accountId, agent: 'claude', revokedAt: 1 });
    const resolution = await fixture.environment.installCodeDirectory.resolve({ installCode, now: fixture.environment.clock.now() });
    expect(resolution.status).toBe(InstallCodeStatus.Unknown);
  });

  test('a rotation makes the old code unknown and the new code ready', async () => {
    const { fixture, installCode } = await createdFixture();
    await rotateAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
    const [, rotated] = fixture.environment.installCodeVault.issued;
    const now = fixture.environment.clock.now();
    const { installCodeDirectory } = fixture.environment;
    expect((await installCodeDirectory.resolve({ installCode, now })).status).toBe(InstallCodeStatus.Unknown);
    expect((await installCodeDirectory.resolve({ installCode: rotated!.installCode, now })).status).toBe(InstallCodeStatus.Ready);
  });

  test('the sealed secret opens only with its own code', async () => {
    const { fixture, installCode, connection } = await createdFixture();
    const { installCodeVault } = fixture.environment;
    await expect(installCodeVault.open({ installCode: `${installCode}x`, sealed: connection.installCodeSealedSecret! })).rejects.toThrow();
  });
});
