import type { ConnectionIdentity } from '../inbox/connection';

export function wakeAssociatedData(input: ConnectionIdentity): string {
  return `${input.accountId}:${input.agent}`;
}
