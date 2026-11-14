import { notFound } from '../../inbox/inbox-error-factories';
import type { OwnerAccountContext } from '../account-types';
import type { AccountDependencies } from '../ports';

const ACCOUNT_NOT_FOUND_MESSAGE = 'account: not found';

export async function loadOwnerAccount(input: { dependencies: AccountDependencies; accountId: string }): Promise<OwnerAccountContext> {
  const record = await input.dependencies.accounts.findById({ accountId: input.accountId });
  if (record === null) throw notFound({ message: ACCOUNT_NOT_FOUND_MESSAGE });
  const { accountId, waId, state, locale } = record;
  return { accountId, waId, state, locale };
}
