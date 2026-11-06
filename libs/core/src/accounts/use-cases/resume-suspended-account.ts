import { AccountState } from '@zapbip/types';
import type { ResumeSuspendedAccountInput } from './types';

export async function resumeSuspendedAccount(input: ResumeSuspendedAccountInput): Promise<boolean> {
  const { dependencies, accountId } = input;
  const suspended = await dependencies.accounts.listByState({ state: AccountState.Suspended });
  const isSuspended = suspended.some((account) => account.accountId === accountId);
  if (!isSuspended) return false;
  await dependencies.accounts.setState({ accountId, state: AccountState.Active });
  return true;
}
