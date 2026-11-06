import { OwnerLocale } from '@zapbip/types';
import directoryMigrationSql from '../../migrations/0001_core.sql?raw';
import { hashConnectionSecret } from '../../src/adapters/platform/hash';
import { testEnv } from './workers-env';

export const SEED_CREATED_AT = 1_700_000_000_000;
const STATEMENT_SEPARATOR = ';';

export async function applyDirectoryMigration(): Promise<void> {
  const statements = directoryMigrationSql
    .split(STATEMENT_SEPARATOR)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
  await testEnv.CONNECTIONS.batch(statements.map((statement) => testEnv.CONNECTIONS.prepare(statement)));
}

export async function seedAccount(input: { accountId: string }): Promise<void> {
  await testEnv.CONNECTIONS.prepare('INSERT OR IGNORE INTO accounts (id, created_at) VALUES (?, ?)')
    .bind(input.accountId, SEED_CREATED_AT)
    .run();
}

export async function seedOwnerIdentity(input: { accountId: string; phone: string; ownerLocale: OwnerLocale }): Promise<void> {
  await seedAccount({ accountId: input.accountId });
  await testEnv.CONNECTIONS.prepare(
    'INSERT INTO owner_identities (wa_id, account_id, from_user_id, locale, created_at) VALUES (?, ?, NULL, ?, ?)',
  )
    .bind(input.phone, input.accountId, input.ownerLocale, SEED_CREATED_AT)
    .run();
}

export async function seedConnection(input: { accountId: string; agent: string; secret: string }): Promise<string> {
  const secretDigest = await hashConnectionSecret({ secret: input.secret });
  await seedAccount({ accountId: input.accountId });
  await testEnv.CONNECTIONS.prepare('INSERT INTO connections (id, account_id, agent, secret_digest, created_at) VALUES (?, ?, ?, ?, ?)')
    .bind(`con_${input.accountId}_${input.agent}`, input.accountId, input.agent, secretDigest, SEED_CREATED_AT)
    .run();
  return secretDigest;
}
