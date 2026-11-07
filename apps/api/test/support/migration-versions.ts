import { ACCOUNT_INBOX_MIGRATIONS } from '../../src/account-inbox/migrations';

const LATEST_MIGRATION_VERSION = Math.max(...ACCOUNT_INBOX_MIGRATIONS.map((migration) => migration.version));

export function versionAfterLatest(input: { offset: number }): number {
  return LATEST_MIGRATION_VERSION + input.offset;
}
