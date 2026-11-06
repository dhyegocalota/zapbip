import type { ConnectionIdentity } from '../inbox/connection';

export function wakeAssociatedData(input: Pick<ConnectionIdentity, 'accountId' | 'agent'>): string {
  return `${input.accountId}:${input.agent}`;
}
