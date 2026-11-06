import type { AccountState } from '@zapbip/types';
import type { AccountCommand, AccountStateVerdict } from './account-types';

export function evaluateAccountState(input: {
  state: AccountState;
  command: AccountCommand | null;
  isFirstMessage: boolean;
  isText: boolean;
}): AccountStateVerdict {
  void input;
  throw new Error('evaluateAccountState is not implemented');
}
