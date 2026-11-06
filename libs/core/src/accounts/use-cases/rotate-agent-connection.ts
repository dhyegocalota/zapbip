import type { AccountCommandResult } from '../account-types';
import type { RotateAgentConnectionInput } from './types';

export function rotateAgentConnection(input: RotateAgentConnectionInput): Promise<AccountCommandResult> {
  void input;
  throw new Error('rotateAgentConnection is not implemented');
}
