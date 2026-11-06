import type { ConnectionIdentity } from '../inbox/connection';

export function wakeAssociatedData(input: ConnectionIdentity): string {
  void input;
  throw new Error('wakeAssociatedData is not implemented');
}
