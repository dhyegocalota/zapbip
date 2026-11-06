import { AccountReplyIntent, AccountReplyParameter, RegisterOutcome } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { AGENTS_PER_ACCOUNT_LIMIT, INSTALL_CODE_TTL_MS, NO_INSTALL_CODE } from '../constants';
import { AGENT_NAME_MAX_CHARS } from '../../inbox/constants';
import { addAgent, createAccountFixture, intentsOf, ownerInputOf, PUBLIC_ORIGIN } from '../testing/fixtures';
import { createAgentConnection } from './create-agent-connection';

async function create(input: { rawName: string }) {
  const fixture = await createAccountFixture();
  const result = await createAgentConnection({ ...ownerInputOf(fixture), rawName: input.rawName });
  return { fixture, result };
}

describe('createAgentConnection', () => {
  test('creates the normalised connection and replies with the install link only', async () => {
    const { fixture, result } = await create({ rawName: 'Claude Code' });
    const [issued] = fixture.environment.secrets.issued;
    const [installCode] = fixture.environment.installCodeVault.issued;
    const [active] = await fixture.environment.registry.listActive({ accountId: fixture.account.accountId });
    const [reply] = result.replies;
    const installPrompt = reply!.parameters[AccountReplyParameter.InstallPrompt]!;
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.Created]);
    expect(active!.agent).toBe('claude-code');
    expect(reply!.parameters[AccountReplyParameter.AgentName]).toBe('claude-code');
    expect(installPrompt).toContain(`${PUBLIC_ORIGIN}/i/${installCode!.installCode}`);
    expect(installPrompt).not.toContain('/c/');
    expect(installPrompt).not.toContain(issued!.secret);
    expect(result.compensation).toEqual({
      connectionId: active!.connectionId,
      agent: 'claude-code',
      oldDigest: null,
      newDigest: issued!.digest,
      oldInstallCode: NO_INSTALL_CODE,
    });
  });

  test('stores the install code digest, the sealed secret and a thirty minute expiry', async () => {
    const { fixture } = await create({ rawName: 'claude' });
    const [issued] = fixture.environment.secrets.issued;
    const [installCode] = fixture.environment.installCodeVault.issued;
    const [active] = await fixture.environment.registry.listActive({ accountId: fixture.account.accountId });
    expect(active!.installCodeDigest).toBe(installCode!.digest);
    expect(active!.installCodeExpiresAt).toBe(fixture.environment.clock.now() + INSTALL_CODE_TTL_MS);
    const sealed = active!.installCodeSealedSecret!;
    expect(await fixture.environment.installCodeVault.open({ installCode: installCode!.installCode, sealed })).toBe(issued!.secret);
  });

  test('an empty name replies with usage', async () => {
    const { fixture, result } = await create({ rawName: '' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.Usage]);
    expect(fixture.environment.secrets.issued).toEqual([]);
  });

  test('a reserved name is refused', async () => {
    const { fixture, result } = await create({ rawName: 'Ajuda' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.ReservedName]);
    expect(await fixture.environment.registry.listActive({ accountId: fixture.account.accountId })).toEqual([]);
  });

  test.each([{ rawName: '!!!' }, { rawName: 'a'.repeat(AGENT_NAME_MAX_CHARS + 1) }])(
    'an invalid name $rawName is refused',
    async ({ rawName }) => {
      const { result } = await create({ rawName });
      expect(intentsOf({ result })).toEqual([AccountReplyIntent.InvalidName]);
    },
  );

  test('a name in use is refused before a secret is issued', async () => {
    const fixture = await createAccountFixture();
    await addAgent({ ...fixture, agent: 'claude' });
    const issuedBefore = fixture.environment.secrets.issued.length;
    const result = await createAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.NameTaken]);
    expect(fixture.environment.secrets.issued).toHaveLength(issuedBefore);
  });

  test('a revoked name can be created again with a different digest', async () => {
    const fixture = await createAccountFixture();
    const oldDigest = await addAgent({ ...fixture, agent: 'claude' });
    await fixture.environment.registry.revoke({ accountId: fixture.account.accountId, agent: 'claude', revokedAt: 1 });
    const result = await createAgentConnection({ ...ownerInputOf(fixture), rawName: 'claude' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.Created]);
    expect(result.compensation!.newDigest).not.toBe(oldDigest);
  });

  test('the agent limit is enforced and reported', async () => {
    const fixture = await createAccountFixture();
    await Promise.all(Array.from({ length: AGENTS_PER_ACCOUNT_LIMIT }, (_, index) => addAgent({ ...fixture, agent: `agent-${index}` })));
    const result = await createAgentConnection({ ...ownerInputOf(fixture), rawName: 'extra' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.LimitReached]);
    expect(result.replies[0]!.parameters[AccountReplyParameter.Limit]).toBe(String(AGENTS_PER_ACCOUNT_LIMIT));
    expect(result.compensation).toBeNull();
  });

  test('one below the limit still creates, revoked agents do not count', async () => {
    const fixture = await createAccountFixture();
    await Promise.all(
      Array.from({ length: AGENTS_PER_ACCOUNT_LIMIT - 1 }, (_, index) => addAgent({ ...fixture, agent: `agent-${index}` })),
    );
    await addAgent({ ...fixture, agent: 'old' });
    await fixture.environment.registry.revoke({ accountId: fixture.account.accountId, agent: 'old', revokedAt: 1 });
    const result = await createAgentConnection({ ...ownerInputOf(fixture), rawName: 'extra' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.Created]);
  });

  test('a lost registration race replies name taken and carries no compensation', async () => {
    const fixture = await createAccountFixture();
    const dependencies = {
      ...fixture.environment.dependencies,
      connections: { ...fixture.environment.registry, register: async () => RegisterOutcome.NameTaken },
    };
    const result = await createAgentConnection({ ...ownerInputOf(fixture), dependencies, rawName: 'claude' });
    expect(intentsOf({ result })).toEqual([AccountReplyIntent.NameTaken]);
    expect(result.compensation).toBeNull();
  });
});
