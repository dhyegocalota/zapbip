import { finishDeletingAccounts } from '@zapbip/core';
import { D1AccountDirectory } from '../adapters/d1/d1-account-directory';
import { createIdGenerator } from '../adapters/platform/ids';
import { R2AccountMedia } from '../adapters/r2/r2-account-media';
import type { Bindings } from '../contract/env';

export function sweepDeletingAccounts(input: { environment: Bindings }): Promise<void> {
  const { environment } = input;
  return finishDeletingAccounts({
    dependencies: {
      accounts: new D1AccountDirectory({ database: environment.CONNECTIONS }),
      accountMedia: new R2AccountMedia({ bucket: environment.MEDIA }),
      ids: createIdGenerator(),
    },
    inboxPurgeFor: ({ accountId }) => ({
      purge: () => environment.ACCOUNT_INBOX.get(environment.ACCOUNT_INBOX.idFromName(accountId)).purge(),
    }),
  });
}
