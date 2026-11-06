import type { Bindings } from '../contract/env';

export function sweepDeletingAccounts(input: { environment: Bindings }): Promise<void> {
  void input;
  throw new Error('sweepDeletingAccounts is not implemented');
}
