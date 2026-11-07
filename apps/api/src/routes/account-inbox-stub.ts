import type { AccountInboxRpc } from '../contract/account-inbox-rpc';
import type { Bindings } from '../contract/env';

export function accountInboxOf<Rpc = AccountInboxRpc>(input: { bindings: Bindings; accountId: string }): Rpc {
  const stub = input.bindings.ACCOUNT_INBOX.get(input.bindings.ACCOUNT_INBOX.idFromName(input.accountId));
  return stub as unknown as Rpc;
}
