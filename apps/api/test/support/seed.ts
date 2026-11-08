import { AccountState, OwnerLocale } from '@zapbip/types';
import coreMigrationSql from '../../migrations/0001_core.sql?raw';
import accountsMigrationSql from '../../migrations/0002_accounts_and_keys.sql?raw';
import channelMigrationSql from '../../migrations/0004_whatsapp_channel.sql?raw';
import backofficeMigrationSql from '../../migrations/0005_backoffice.sql?raw';
import backofficeFlashMigrationSql from '../../migrations/0006_backoffice_flash.sql?raw';
import activityMigrationSql from '../../migrations/0007_activity.sql?raw';
import { hashConnectionSecret } from '../../src/adapters/platform/hash';
import { accountInboxStub, testEnv } from './workers-env';

export const SEED_CREATED_AT = 1_700_000_000_000;
const STATEMENT_SEPARATOR = ';';
const CONNECTION_ID_DIGEST_CHARS = 16;

export async function applyMigration(input: { sql: string }): Promise<void> {
  const statements = input.sql
    .split(STATEMENT_SEPARATOR)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
  await testEnv.CONNECTIONS.batch(statements.map((statement) => testEnv.CONNECTIONS.prepare(statement)));
}

export async function applyCoreMigration(): Promise<void> {
  await applyMigration({ sql: coreMigrationSql });
}

export async function applyAccountsMigration(): Promise<void> {
  await applyMigration({ sql: accountsMigrationSql });
}

export async function applyChannelMigration(): Promise<void> {
  await applyMigration({ sql: channelMigrationSql });
}

export async function applyBackofficeMigration(): Promise<void> {
  await applyMigration({ sql: backofficeMigrationSql });
}

export async function applyBackofficeFlashMigration(): Promise<void> {
  await applyMigration({ sql: backofficeFlashMigrationSql });
}

export async function applyActivityMigration(): Promise<void> {
  await applyMigration({ sql: activityMigrationSql });
}

export async function applyDirectoryMigration(): Promise<void> {
  await applyCoreMigration();
  await applyAccountsMigration();
  await applyChannelMigration();
  await applyBackofficeMigration();
  await applyBackofficeFlashMigration();
  await applyActivityMigration();
}

export async function seedAccount(input: { accountId: string; state?: AccountState; numberId?: string | null }): Promise<void> {
  const { accountId, state = AccountState.Active, numberId = null } = input;
  await testEnv.CONNECTIONS.prepare(
    'INSERT INTO accounts (id, state, created_at, number_id) VALUES (?, ?, ?, ?) ON CONFLICT (id) DO NOTHING',
  )
    .bind(accountId, state, SEED_CREATED_AT, numberId)
    .run();
}

export async function seedOwnerIdentity(input: {
  accountId: string;
  phone: string;
  ownerLocale: OwnerLocale;
  numberId?: string | null;
}): Promise<void> {
  await seedAccount({ accountId: input.accountId, numberId: input.numberId });
  await testEnv.CONNECTIONS.prepare(
    'INSERT INTO owner_identities (wa_id, account_id, from_user_id, locale, created_at) VALUES (?, ?, NULL, ?, ?)',
  )
    .bind(input.phone, input.accountId, input.ownerLocale, SEED_CREATED_AT)
    .run();
}

export async function seedConnection(input: {
  accountId: string;
  agent: string;
  secret: string;
  revokedAt?: number | null;
}): Promise<string> {
  const { revokedAt = null } = input;
  const secretDigest = await hashConnectionSecret({ secret: input.secret });
  await seedAccount({ accountId: input.accountId });
  await testEnv.CONNECTIONS.prepare(
    'INSERT INTO connections (id, account_id, agent, secret_digest, created_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
    .bind(
      `con_${secretDigest.slice(0, CONNECTION_ID_DIGEST_CHARS)}`,
      input.accountId,
      input.agent,
      secretDigest,
      SEED_CREATED_AT,
      revokedAt,
    )
    .run();
  if (revokedAt === null) await accountInboxStub({ accountId: input.accountId }).recordCreation({ agent: input.agent, secretDigest });
  return secretDigest;
}
