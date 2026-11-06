import { AccountState } from '@zapbip/types';
import type { FinishAccountDeletionInput } from './types';

export async function finishAccountDeletion(input: FinishAccountDeletionInput): Promise<void> {
  const { dependencies, accountId, inboxPurge } = input;
  await dependencies.accounts.setState({ accountId, state: AccountState.Deleting });
  await inboxPurge.purge();
  await dependencies.accountMedia.deleteAll({ accountId });
  await dependencies.accounts.remove({ accountId });
}
