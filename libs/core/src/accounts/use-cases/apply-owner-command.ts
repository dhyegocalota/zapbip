import type { AccountCommandResult } from '../account-types';
import type { ApplyOwnerCommandInput } from './types';

export function applyOwnerCommand(input: ApplyOwnerCommandInput): Promise<AccountCommandResult> {
  void input;
  throw new Error('applyOwnerCommand is not implemented');
}
