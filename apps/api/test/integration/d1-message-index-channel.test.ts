import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reset } from 'cloudflare:test';
import { D1MessageIndex } from '../../src/adapters/d1/d1-message-index';
import { applyDirectoryMigration, seedAccount, SEED_CREATED_AT } from '../support/seed';
import { testEnv } from '../support/workers-env';

const FIRST_ACCOUNT = 'acc_1';
const SECOND_ACCOUNT = 'acc_2';
const OUTBOUND_ID = 'wamid.outbound.1';
const LATER_TIME = SEED_CREATED_AT + 60_000;

function index(): D1MessageIndex {
  return new D1MessageIndex({ database: testEnv.CONNECTIONS });
}

async function readCreatedAt(input: { id: string }): Promise<number | undefined> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT created_at AS createdAt FROM message_index WHERE wamid = ?')
    .bind(input.id)
    .first<{ createdAt: number }>();
  return row?.createdAt;
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedAccount({ accountId: FIRST_ACCOUNT });
  await seedAccount({ accountId: SECOND_ACCOUNT });
});
afterEach(reset);

describe('D1 message index for channel ids', () => {
  it('pin: keeps the time of the first record when the same id is recorded again', async () => {
    await index().record({ id: OUTBOUND_ID, accountId: FIRST_ACCOUNT, at: SEED_CREATED_AT });
    await index().record({ id: OUTBOUND_ID, accountId: FIRST_ACCOUNT, at: LATER_TIME });
    expect(await readCreatedAt({ id: OUTBOUND_ID })).toBe(SEED_CREATED_AT);
  });

  it('pin: routes a status id to the account that sent it', async () => {
    await index().record({ id: OUTBOUND_ID, accountId: SECOND_ACCOUNT, at: SEED_CREATED_AT });
    await index().record({ id: 'wamid.outbound.2', accountId: FIRST_ACCOUNT, at: SEED_CREATED_AT });
    expect(await index().find({ id: OUTBOUND_ID })).toEqual({ accountId: SECOND_ACCOUNT });
  });

  it('pin: treats an id as case sensitive', async () => {
    await index().record({ id: OUTBOUND_ID, accountId: FIRST_ACCOUNT, at: SEED_CREATED_AT });
    expect(await index().find({ id: OUTBOUND_ID.toUpperCase() })).toBeNull();
  });
});
