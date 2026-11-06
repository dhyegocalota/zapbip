export type Migration = { version: number; sql: string };

const CREATE_SCHEMA_VERSIONS_STATEMENT =
  'CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)';
const LIST_APPLIED_STATEMENT = 'SELECT version FROM schema_versions';
const RECORD_APPLIED_STATEMENT = 'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)';

export function runMigrations(input: { storage: DurableObjectStorage; migrations: Migration[] }): number[] {
  input.storage.sql.exec(CREATE_SCHEMA_VERSIONS_STATEMENT);
  const appliedVersions = new Set(
    input.storage.sql
      .exec<{ version: number }>(LIST_APPLIED_STATEMENT)
      .toArray()
      .map((row) => row.version),
  );
  const pending = input.migrations
    .filter((migration) => !appliedVersions.has(migration.version))
    .sort((first, second) => first.version - second.version);
  pending.forEach((migration) =>
    input.storage.transactionSync(() => {
      input.storage.sql.exec(migration.sql);
      input.storage.sql.exec(RECORD_APPLIED_STATEMENT, migration.version, Date.now());
    }),
  );
  return pending.map((migration) => migration.version);
}
