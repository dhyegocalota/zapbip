import { finishDeletingAccounts } from '@zapbip/core';
import { D1AccountDirectory } from '../adapters/d1/d1-account-directory';
import { createIdGenerator } from '../adapters/platform/ids';
import { R2AccountMedia } from '../adapters/r2/r2-account-media';
import type { Bindings } from '../contract/env';

const CLEAR_EXPIRED_INSTALL_SECRETS_STATEMENT =
  'UPDATE connections SET install_code_sealed_secret = NULL WHERE install_code_expires_at <= ?';

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

export async function clearExpiredInstallSecrets(input: { environment: Bindings; now: number }): Promise<void> {
  await input.environment.CONNECTIONS.prepare(CLEAR_EXPIRED_INSTALL_SECRETS_STATEMENT).bind(input.now).run();
}
