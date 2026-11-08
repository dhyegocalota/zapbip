import { NO_INSTALL_CODE, type ConnectionRecord, type NewConnection } from '@zapbip/core';
import { AccountState, OwnerLocale, RegisterOutcome } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { D1ConnectionDirectory } from '../../src/adapters/d1/d1-connection-directory';
import { D1ConnectionRegistry } from '../../src/adapters/d1/d1-connection-registry';
import { hashConnectionSecret } from '../../src/adapters/platform/hash';
import { resolveConnection } from '../../src/routes/resolve-connection';
import { applyDirectoryMigration, SEED_CREATED_AT, seedAccount, seedConnection, seedOwnerIdentity } from '../support/seed';
import { testEnv } from '../support/workers-env';

const ACCOUNT_ID = 'acc_1';
const PHONE = '5511900000000';
const ACTIVE_LIMIT = 8;
const CONCURRENT_CALLS = 20;
const REVOKES_IN_RACE = 3;
const REVOKED_AT = SEED_CREATED_AT + 1;
const ROTATED_AT = SEED_CREATED_AT + 2;
const SECRET = `zb_conn_${'G'.repeat(43)}`;
const NEW_SECRET = `zb_conn_${'H'.repeat(43)}`;
const THIRD_SECRET = `zb_conn_${'J'.repeat(43)}`;
const MALFORMED_SECRET = 'zb_conn_short';
const SECRET_PREFIX_PATTERN = /zb_conn_/;

function directory(): D1ConnectionDirectory {
  return new D1ConnectionDirectory({ database: testEnv.CONNECTIONS });
}

function registry(): D1ConnectionRegistry {
  return new D1ConnectionRegistry({ database: testEnv.CONNECTIONS });
}

async function digestOf(input: { secret: string }): Promise<string> {
  return hashConnectionSecret(input);
}

async function connectionRecord(input: { agent: string; accountId?: string }): Promise<NewConnection> {
  const { accountId = ACCOUNT_ID } = input;
  const id = crypto.randomUUID();
  return {
    connectionId: `con_${id}`,
    accountId,
    agent: input.agent,
    secretDigest: await digestOf({ secret: id }),
    createdAt: SEED_CREATED_AT,
    installCodeDigest: null,
    installCodeSealedSecret: null,
    installCodeExpiresAt: null,
  };
}

function withReadColumns(connection: NewConnection): ConnectionRecord {
  return { ...connection, clientName: null, firstCallAt: null };
}

async function registerAgents(input: { agents: string[]; activeLimit?: number }): Promise<RegisterOutcome[]> {
  const { activeLimit = ACTIVE_LIMIT } = input;
  const connections = await Promise.all(input.agents.map((agent) => connectionRecord({ agent })));
  return Promise.all(connections.map((connection) => registry().register({ connection, activeLimit })));
}

async function countActive(): Promise<number> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT COUNT(*) AS total FROM connections WHERE revoked_at IS NULL').first<{
    total: number;
  }>();
  if (row === null) throw new Error('count missing');
  return row.total;
}

function agentNames(input: { count: number }): string[] {
  return Array.from({ length: input.count }, (_, index) => `agent-${index}`);
}

function countOf(input: { outcomes: RegisterOutcome[]; outcome: RegisterOutcome }): number {
  return input.outcomes.filter((candidate) => candidate === input.outcome).length;
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedOwnerIdentity({ accountId: ACCOUNT_ID, phone: PHONE, ownerLocale: OwnerLocale.PortugueseBrazil });
});
afterEach(reset);

describe('D1 connection directory resolve', () => {
  async function resolve(input: { secret: string }) {
    return directory().resolveSecretDigest({ secretDigest: await digestOf(input) });
  }

  it('resolves an active connection of an active account', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'alpha', secret: SECRET });
    expect(await resolve({ secret: SECRET })).toEqual({ accountId: ACCOUNT_ID, agent: 'alpha', ownerLocale: OwnerLocale.PortugueseBrazil });
  });

  it('resolves a revoked connection to null', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'alpha', secret: SECRET, revokedAt: REVOKED_AT });
    expect(await resolve({ secret: SECRET })).toBeNull();
  });

  it.each([AccountState.Suspended, AccountState.Deleting, AccountState.Waitlisted])(
    'resolves a connection of a %s account to null',
    async (state) => {
      await seedConnection({ accountId: ACCOUNT_ID, agent: 'alpha', secret: SECRET });
      await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(state, ACCOUNT_ID).run();
      expect(await resolve({ secret: SECRET })).toBeNull();
    },
  );

  it('resolves again once the account is set back to active', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'alpha', secret: SECRET });
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(AccountState.Suspended, ACCOUNT_ID).run();
    expect(await resolve({ secret: SECRET })).toBeNull();
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(AccountState.Active, ACCOUNT_ID).run();
    expect(await resolve({ secret: SECRET })).not.toBeNull();
  });

  it('pin answers a malformed secret without reading D1', async () => {
    await testEnv.CONNECTIONS.prepare('DROP TABLE connections').run();
    expect(await resolveConnection({ database: testEnv.CONNECTIONS, secret: MALFORMED_SECRET })).toBeNull();
  });
});

describe('D1 connection registry register', () => {
  it('registers the eighth active agent', async () => {
    await registerAgents({ agents: agentNames({ count: ACTIVE_LIMIT - 1 }) });
    const [outcome] = await registerAgents({ agents: ['last'] });
    expect(outcome).toBe(RegisterOutcome.Registered);
    expect(await countActive()).toBe(ACTIVE_LIMIT);
  });

  it('refuses the ninth active agent', async () => {
    await registerAgents({ agents: agentNames({ count: ACTIVE_LIMIT }) });
    const [outcome] = await registerAgents({ agents: ['ninth'] });
    expect(outcome).toBe(RegisterOutcome.LimitReached);
    expect(await countActive()).toBe(ACTIVE_LIMIT);
  });

  it('does not count a revoked row against the limit', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'old', secret: SECRET, revokedAt: REVOKED_AT });
    await registerAgents({ agents: agentNames({ count: ACTIVE_LIMIT - 1 }) });
    const [outcome] = await registerAgents({ agents: ['last'] });
    expect(outcome).toBe(RegisterOutcome.Registered);
  });

  it('registers exactly the limit under concurrent creates', async () => {
    const outcomes = await registerAgents({ agents: agentNames({ count: CONCURRENT_CALLS }) });
    expect(countOf({ outcomes, outcome: RegisterOutcome.Registered })).toBe(ACTIVE_LIMIT);
    expect(countOf({ outcomes, outcome: RegisterOutcome.LimitReached })).toBe(CONCURRENT_CALLS - ACTIVE_LIMIT);
    expect(await countActive()).toBe(ACTIVE_LIMIT);
  });

  it('[row 507] never leaves more than the limit active when twenty creates race three revokes for the last slot', async () => {
    const seeded = agentNames({ count: ACTIVE_LIMIT - 1 });
    await registerAgents({ agents: seeded });
    const racers = agentNames({ count: CONCURRENT_CALLS }).map((agent) => `racer-${agent}`);
    const revokedAgents = seeded.slice(0, REVOKES_IN_RACE);
    const [outcomes, revocations] = await Promise.all([
      registerAgents({ agents: racers }),
      Promise.all(revokedAgents.map((agent) => registry().revoke({ accountId: ACCOUNT_ID, agent, revokedAt: REVOKED_AT }))),
    ]);
    const registered = countOf({ outcomes, outcome: RegisterOutcome.Registered });
    expect(revocations.every(Boolean)).toBe(true);
    expect(registered).toBeLessThanOrEqual(1 + REVOKES_IN_RACE);
    expect(await countActive()).toBe(ACTIVE_LIMIT - 1 + registered - REVOKES_IN_RACE);
    expect(await countActive()).toBeLessThanOrEqual(ACTIVE_LIMIT);
  });

  it('gives one of two concurrent creates of the same name the name taken outcome', async () => {
    const outcomes = await registerAgents({ agents: ['claude', 'claude'] });
    expect(countOf({ outcomes, outcome: RegisterOutcome.Registered })).toBe(1);
    expect(countOf({ outcomes, outcome: RegisterOutcome.NameTaken })).toBe(1);
  });

  it('registers a name again after its connection was revoked', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'claude', secret: SECRET, revokedAt: REVOKED_AT });
    const [outcome] = await registerAgents({ agents: ['claude'] });
    expect(outcome).toBe(RegisterOutcome.Registered);
  });
});

describe('D1 connection registry reads and writes', () => {
  it('finds the active connection of an agent and not a revoked one', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'claude', secret: SECRET });
    expect(await registry().findActiveByAgent({ accountId: ACCOUNT_ID, agent: 'claude' })).toMatchObject({
      accountId: ACCOUNT_ID,
      agent: 'claude',
      secretDigest: await digestOf({ secret: SECRET }),
    });
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'agent-two', secret: NEW_SECRET, revokedAt: REVOKED_AT });
    expect(await registry().findActiveByAgent({ accountId: ACCOUNT_ID, agent: 'agent-two' })).toBeNull();
  });

  it('lists the active connections ordered by creation', async () => {
    const first = { ...(await connectionRecord({ agent: 'first' })), createdAt: 1 };
    const second = { ...(await connectionRecord({ agent: 'second' })), createdAt: 2 };
    await registry().register({ connection: second, activeLimit: ACTIVE_LIMIT });
    await registry().register({ connection: first, activeLimit: ACTIVE_LIMIT });
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'gone', secret: SECRET, revokedAt: REVOKED_AT });
    expect(await registry().listActive({ accountId: ACCOUNT_ID })).toEqual([withReadColumns(first), withReadColumns(second)]);
  });

  it('revokes once', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'claude', secret: SECRET });
    expect(await registry().revoke({ accountId: ACCOUNT_ID, agent: 'claude', revokedAt: REVOKED_AT })).toBe(true);
    expect(await registry().revoke({ accountId: ACCOUNT_ID, agent: 'claude', revokedAt: REVOKED_AT })).toBe(false);
    const row = await testEnv.CONNECTIONS.prepare('SELECT revoked_at FROM connections').first<{ revoked_at: number }>();
    expect(row?.revoked_at).toBe(REVOKED_AT);
  });

  it('rotates from the stored digest and stops the old digest at once', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'claude', secret: SECRET });
    const fromDigest = await digestOf({ secret: SECRET });
    const toDigest = await digestOf({ secret: NEW_SECRET });
    expect(
      await registry().rotate({
        accountId: ACCOUNT_ID,
        agent: 'claude',
        fromDigest,
        toDigest,
        installCode: NO_INSTALL_CODE,
        rotatedAt: ROTATED_AT,
      }),
    ).toBe(true);
    expect(await directory().resolveSecretDigest({ secretDigest: fromDigest })).toBeNull();
    expect(await directory().resolveSecretDigest({ secretDigest: toDigest })).not.toBeNull();
  });

  it('does not rotate from a digest that is not the stored one', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'claude', secret: SECRET });
    const rotated = await registry().rotate({
      accountId: ACCOUNT_ID,
      agent: 'claude',
      fromDigest: await digestOf({ secret: THIRD_SECRET }),
      toDigest: await digestOf({ secret: NEW_SECRET }),
      installCode: NO_INSTALL_CODE,
      rotatedAt: ROTATED_AT,
    });
    expect(rotated).toBe(false);
    expect((await registry().findActiveByAgent({ accountId: ACCOUNT_ID, agent: 'claude' }))?.secretDigest).toBe(
      await digestOf({ secret: SECRET }),
    );
  });

  it('lets exactly one of two concurrent rotations win', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'claude', secret: SECRET });
    const fromDigest = await digestOf({ secret: SECRET });
    const outcomes = await Promise.all(
      [NEW_SECRET, THIRD_SECRET].map(async (secret) =>
        registry().rotate({
          accountId: ACCOUNT_ID,
          agent: 'claude',
          fromDigest,
          toDigest: await digestOf({ secret }),
          installCode: NO_INSTALL_CODE,
          rotatedAt: ROTATED_AT,
        }),
      ),
    );
    expect(outcomes.filter(Boolean)).toHaveLength(1);
  });

  it('refuses a rotation to a digest another connection already holds', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'claude', secret: SECRET });
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'agent-two', secret: NEW_SECRET });
    await expect(
      registry().rotate({
        accountId: ACCOUNT_ID,
        agent: 'claude',
        fromDigest: await digestOf({ secret: SECRET }),
        toDigest: await digestOf({ secret: NEW_SECRET }),
        installCode: NO_INSTALL_CODE,
        rotatedAt: ROTATED_AT,
      }),
    ).rejects.toThrow(/UNIQUE/);
  });

  it('stores digests only and keeps the phone in the identity table alone', async () => {
    await seedAccount({ accountId: 'acc_2' });
    const [outcome] = await registerAgents({ agents: ['claude'] });
    expect(outcome).toBe(RegisterOutcome.Registered);
    const rows = await testEnv.CONNECTIONS.prepare('SELECT * FROM connections').all<Record<string, unknown>>();
    expect(
      rows.results
        .flatMap((row) => Object.values(row))
        .map(String)
        .join(' '),
    ).not.toMatch(SECRET_PREFIX_PATTERN);
    expect(JSON.stringify(rows.results)).not.toContain(PHONE);
  });
});
