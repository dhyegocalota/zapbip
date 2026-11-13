import type { AccountCommandResult } from '../account-types';
import type { OwnerAccountInput } from './types';

export async function issueSignInLink(_input: OwnerAccountInput): Promise<AccountCommandResult> {
  throw new Error('issueSignInLink is not implemented');
}
