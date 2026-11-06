import { AccountReplyIntent } from '@zapbip/types';
import type { AccountCommandResult } from '../account-types';
import { DELETION_CONFIRM_TTL_MS } from '../constants';
import { buildResult, buildTextReply } from './account-reply';
import type { ConfirmAccountDeletionInput } from './types';

export async function isDeletionRequestLive(input: Pick<ConfirmAccountDeletionInput, 'dependencies'>): Promise<boolean> {
  const { dependencies } = input;
  const requestedAt = await dependencies.deletionRequests.find();
  return requestedAt !== null && dependencies.clock.now() - requestedAt <= DELETION_CONFIRM_TTL_MS;
}

export async function confirmAccountDeletion(input: ConfirmAccountDeletionInput): Promise<AccountCommandResult> {
  const { dependencies, account } = input;
  const { locale } = account;
  const isRequestLive = await isDeletionRequestLive({ dependencies });
  if (isRequestLive) {
    return buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.DeletionDone, locale })], deletionConfirmed: true });
  }
  await dependencies.deletionRequests.clear();
  return buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.DeletionExpired, locale })] });
}
