import type { InboxRepository } from '@zapbip/core';
import { runInDurableObject } from 'cloudflare:test';
import { ACCOUNT_INBOX_MIGRATIONS } from '../../src/account-inbox/migrations';
import { runMigrations } from '../../src/account-inbox/run-migrations';
import { createSqliteInboxRepository } from '../../src/adapters/sqlite/sqlite-inbox-repository';
import { accountInboxStub } from './workers-env';

export function withRepository<Result>(input: {
  accountId: string;
  run: (repository: InboxRepository, storage: DurableObjectStorage) => Promise<Result>;
}): Promise<Result> {
  return runInDurableObject(accountInboxStub({ accountId: input.accountId }), async (_instance, state) => {
    runMigrations({ storage: state.storage, migrations: ACCOUNT_INBOX_MIGRATIONS });
    return input.run(createSqliteInboxRepository({ storage: state.storage }), state.storage);
  });
}
