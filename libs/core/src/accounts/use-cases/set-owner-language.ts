import { AccountReplyIntent } from '@zapbip/types';
import type { AccountCommandResult } from '../account-types';
import { ownerLanguageOfValue } from '../owner-locale';
import { buildResult, buildTextReply } from './account-reply';
import type { OwnerAccountInput } from './types';

type SetOwnerLanguageInput = OwnerAccountInput & { rawValue: string };

export async function setOwnerLanguage(input: SetOwnerLanguageInput): Promise<AccountCommandResult> {
  const { dependencies, account, rawValue } = input;
  const locale = ownerLanguageOfValue({ value: rawValue });
  if (locale === null) {
    return buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.LanguageUnknown, locale: account.locale })] });
  }
  await dependencies.accounts.setLocale({ accountId: account.accountId, locale });
  return buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.LanguageChanged, locale })] });
}
