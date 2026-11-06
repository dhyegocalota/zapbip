import type { AccountCommandResult } from '../account-types';
import type { ListAgentConnectionsInput } from './types';

export function listAgentConnections(input: ListAgentConnectionsInput): Promise<AccountCommandResult> {
  void input;
  throw new Error('listAgentConnections is not implemented');
}
