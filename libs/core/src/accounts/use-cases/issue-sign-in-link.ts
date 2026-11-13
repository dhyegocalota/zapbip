import { AccountReplyIntent, AccountReplyParameter, SIGN_IN_LINK_TTL_MS } from '@zapbip/types';
import type { AccountCommandResult } from '../account-types';
import { buildSignInLink } from '../sign-in-link';
import { buildResult, buildTextReply } from './account-reply';
import type { OwnerAccountInput } from './types';

export async function issueSignInLink(input: OwnerAccountInput): Promise<AccountCommandResult> {
  const { dependencies, account, appOrigin } = input;
  const issuedAt = dependencies.clock.now();
  const token = await dependencies.signInLinks.issue({ accountId: account.accountId, issuedAt, expiresAt: issuedAt + SIGN_IN_LINK_TTL_MS });
  const parameters = { [AccountReplyParameter.SignInLink]: buildSignInLink({ appOrigin, locale: account.locale, token }) };
  return buildResult({ replies: [buildTextReply({ intent: AccountReplyIntent.SignInLink, locale: account.locale, parameters })] });
}
