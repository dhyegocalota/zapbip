import { finishDeletingAccounts, type AccountInboxPurge, type AccountLifecycleDependencies } from '@zapbip/core';
import { D1AccountDirectory } from '../adapters/d1/d1-account-directory';
import { createIdGenerator } from '../adapters/platform/ids';
import { R2AccountMedia } from '../adapters/r2/r2-account-media';
import type { Bindings } from '../contract/env';

const CLEAR_EXPIRED_INSTALL_SECRETS_STATEMENT =
  'UPDATE connections SET install_code_sealed_secret = NULL WHERE install_code_expires_at <= ?';

export function lifecycleDependenciesOf(input: { environment: Bindings }): AccountLifecycleDependencies {
  const { environment } = input;
  return {
    accounts: new D1AccountDirectory({ database: environment.CONNECTIONS }),
    accountMedia: new R2AccountMedia({ bucket: environment.MEDIA }),
    ids: createIdGenerator(),
  };
}

export function inboxPurgeOf(input: { environment: Bindings; accountId: string }): AccountInboxPurge {
  const { environment, accountId } = input;
  return { purge: () => environment.ACCOUNT_INBOX.get(environment.ACCOUNT_INBOX.idFromName(accountId)).purge() };
}

export function sweepDeletingAccounts(input: { environment: Bindings }): Promise<void> {
  const { environment } = input;
  return finishDeletingAccounts({
    dependencies: lifecycleDependenciesOf({ environment }),
    inboxPurgeFor: ({ accountId }) => inboxPurgeOf({ environment, accountId }),
  });
}

export async function clearExpiredInstallSecrets(input: { environment: Bindings; now: number }): Promise<void> {
  await input.environment.CONNECTIONS.prepare(CLEAR_EXPIRED_INSTALL_SECRETS_STATEMENT).bind(input.now).run();
}
