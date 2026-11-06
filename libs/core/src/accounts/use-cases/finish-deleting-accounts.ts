import { AccountState } from '@zapbip/types';
import { finishAccountDeletion } from './finish-account-deletion';
import type { FinishDeletingAccountsInput } from './types';

export async function finishDeletingAccounts(input: FinishDeletingAccountsInput): Promise<void> {
  const { dependencies, inboxPurgeFor } = input;
  const deleting = await dependencies.accounts.listByState({ state: AccountState.Deleting });
  const outcomes = await Promise.allSettled(
    deleting.map(({ accountId }) => finishAccountDeletion({ dependencies, accountId, inboxPurge: inboxPurgeFor({ accountId }) })),
  );
  const failure = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
  if (failure !== undefined) throw failure.reason;
}
