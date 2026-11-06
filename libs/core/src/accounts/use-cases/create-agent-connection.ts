import type { AccountCommandResult } from '../account-types';
import type { CreateAgentConnectionInput } from './types';

export function createAgentConnection(input: CreateAgentConnectionInput): Promise<AccountCommandResult> {
  void input;
  throw new Error('createAgentConnection is not implemented');
}
