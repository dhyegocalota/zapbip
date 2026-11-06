import type { AccountCommandResult } from '../account-types';
import type { RequestAccountDeletionInput } from './types';

export function requestAccountDeletion(input: RequestAccountDeletionInput): Promise<AccountCommandResult> {
  void input;
  throw new Error('requestAccountDeletion is not implemented');
}
