import { OwnerLocale } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { D1ConnectionDirectory } from '../../src/adapters/d1/d1-connection-directory';
import { findOwnerByPhone } from '../../src/adapters/d1/d1-owner-directory';
import { hashConnectionSecret } from '../../src/adapters/platform/hash';
import { applyDirectoryMigration, seedConnection, seedOwnerIdentity } from '../support/seed';
import { testEnv } from '../support/workers-env';

const ACCOUNT_ID = 'acc_1';
const PHONE = '5511999990000';
const SECRET = `zb_conn_${'B'.repeat(43)}`;

function directory(): D1ConnectionDirectory {
  return new D1ConnectionDirectory({ database: testEnv.CONNECTIONS });
}

async function resolve(input: { secret: string }) {
  return directory().resolveSecretDigest({ secretDigest: await hashConnectionSecret(input) });
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('D1 connection directory', () => {
  it('WI-1 resolves an active digest', async () => {
    await seedOwnerIdentity({ accountId: ACCOUNT_ID, phone: PHONE, ownerLocale: OwnerLocale.PortugueseBrazil });
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'alpha', secret: SECRET });
    expect(await resolve({ secret: SECRET })).toEqual({
      accountId: ACCOUNT_ID,
      agent: 'alpha',
      ownerLocale: OwnerLocale.PortugueseBrazil,
    });
  });

  it('WI-2 resolves a digest with no row to null', async () => {
    expect(await resolve({ secret: SECRET })).toBeNull();
  });

  it('WI-2 resolves a deleted connection to null', async () => {
    await seedOwnerIdentity({ accountId: ACCOUNT_ID, phone: PHONE, ownerLocale: OwnerLocale.PortugueseBrazil });
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'alpha', secret: SECRET });
    await testEnv.CONNECTIONS.prepare('DELETE FROM connections WHERE account_id = ?').bind(ACCOUNT_ID).run();
    expect(await resolve({ secret: SECRET })).toBeNull();
  });

  it('WI-3 resolves a connection without an owner identity to null', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'alpha', secret: SECRET });
    expect(await resolve({ secret: SECRET })).toBeNull();
  });

  it('WI-4 stores the digest and never the secret', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'alpha', secret: SECRET });
    const row = await testEnv.CONNECTIONS.prepare('SELECT * FROM connections').first<Record<string, unknown>>();
    if (!row) throw new Error('connection row missing');
    expect(Object.values(row)).not.toContain(SECRET);
    expect(row.secret_digest).toBe(await hashConnectionSecret({ secret: SECRET }));
  });

  it('WI-6 refuses a second connection with the same agent in one account', async () => {
    await seedConnection({ accountId: ACCOUNT_ID, agent: 'alpha', secret: SECRET });
    await expect(seedConnection({ accountId: ACCOUNT_ID, agent: 'alpha', secret: `${SECRET}x` })).rejects.toThrow(/UNIQUE/);
  });
});

describe('D1 owner directory', () => {
  it('WI-9 finds the owner by phone', async () => {
    await seedOwnerIdentity({ accountId: ACCOUNT_ID, phone: PHONE, ownerLocale: OwnerLocale.PortugueseBrazil });
    expect(await findOwnerByPhone({ database: testEnv.CONNECTIONS, phone: PHONE })).toEqual({
      accountId: ACCOUNT_ID,
      ownerLocale: OwnerLocale.PortugueseBrazil,
    });
  });

  it('WI-9 returns null for an unknown phone', async () => {
    expect(await findOwnerByPhone({ database: testEnv.CONNECTIONS, phone: PHONE })).toBeNull();
  });
});
