import type { OwnerAccountContext } from '../account-types';
import type { OpenOwnerAccountInput } from './types';

export function openOwnerAccount(input: OpenOwnerAccountInput): Promise<OwnerAccountContext | null> {
  void input;
  throw new Error('openOwnerAccount is not implemented');
}
