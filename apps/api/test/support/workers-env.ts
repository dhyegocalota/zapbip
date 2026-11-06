import { env } from 'cloudflare:workers';
import type { AccountInbox } from '../../src/account-inbox/account-inbox';
import type { Bindings } from '../../src/contract/env';

declare global {
  namespace Cloudflare {
    interface Env extends Bindings {}
  }
}

export const testEnv: Bindings = env;

export function accountInboxStub(input: { accountId: string }): DurableObjectStub<AccountInbox> {
  return testEnv.ACCOUNT_INBOX.get(testEnv.ACCOUNT_INBOX.idFromName(input.accountId));
}
