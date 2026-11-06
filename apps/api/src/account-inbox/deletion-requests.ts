import type { DeletionRequests } from '@zapbip/core';

const SAVE_REQUEST_STATEMENT =
  'INSERT INTO account_facts (id, deletion_requested_at) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET deletion_requested_at = excluded.deletion_requested_at';
const CLEAR_REQUEST_STATEMENT = 'UPDATE account_facts SET deletion_requested_at = NULL WHERE id = 1';
const FIND_REQUEST_STATEMENT = 'SELECT deletion_requested_at FROM account_facts WHERE id = 1';

export function createSqliteDeletionRequests(input: { storage: DurableObjectStorage }): DeletionRequests {
  return {
    save: async ({ requestedAt }) => {
      input.storage.sql.exec(SAVE_REQUEST_STATEMENT, requestedAt);
    },
    clear: async () => {
      input.storage.sql.exec(CLEAR_REQUEST_STATEMENT);
    },
    find: async () => {
      const [row] = input.storage.sql.exec<{ deletion_requested_at: number | null }>(FIND_REQUEST_STATEMENT).toArray();
      if (row === undefined) return null;
      return row.deletion_requested_at;
    },
  };
}
