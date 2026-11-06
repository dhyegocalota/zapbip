import type { AccountCommandResult } from '../account-types';
import type { RevokeAgentConnectionInput } from './types';

export function revokeAgentConnection(input: RevokeAgentConnectionInput): Promise<AccountCommandResult> {
  void input;
  throw new Error('revokeAgentConnection is not implemented');
}
