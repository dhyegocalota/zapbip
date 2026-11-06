import type { AccountCommandResult } from '../account-types';
import type { ConfirmAccountDeletionInput } from './types';

export function confirmAccountDeletion(input: ConfirmAccountDeletionInput): Promise<AccountCommandResult> {
  void input;
  throw new Error('confirmAccountDeletion is not implemented');
}
