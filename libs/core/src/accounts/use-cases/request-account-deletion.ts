import { AccountReplyIntent, AccountReplyParameter, CommandKind } from '@zapbip/types';
import type { AccountCommandResult } from '../account-types';
import { buildResult, buildTextReply } from './account-reply';
import type { RequestAccountDeletionInput } from './types';
import { findCommandWords } from './usage-reply';

export async function requestAccountDeletion(input: RequestAccountDeletionInput): Promise<AccountCommandResult> {
  const { dependencies, account } = input;
  const { locale } = account;
  await dependencies.deletionRequests.save({ requestedAt: dependencies.clock.now() });
  const phrase = findCommandWords({ kind: CommandKind.ConfirmDeletion, locale });
  const parameters = { [AccountReplyParameter.Phrase]: phrase };
  return buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.DeletionRequest, locale, parameters })] });
}
