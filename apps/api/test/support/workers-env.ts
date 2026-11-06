import type { ConnectionIdentity } from '@zapbip/core';
import { OwnerLocale } from '@zapbip/types';
import { env } from 'cloudflare:workers';
import type { AccountInbox } from '../../src/account-inbox/account-inbox';
import type { Bindings } from '../../src/contract/env';

declare global {
  namespace Cloudflare {
    interface Env extends Bindings {}
  }
}

export const testEnv: Bindings = env;

export const whatsappTestEnv: Bindings = { ...env, WHATSAPP_ACCESS_TOKEN: 'test-access-token' };

export function accountInboxStub(input: { accountId: string }): DurableObjectStub<AccountInbox> {
  return testEnv.ACCOUNT_INBOX.get(testEnv.ACCOUNT_INBOX.idFromName(input.accountId));
}

export function connectionOf(input: { accountId: string; agent: string }): ConnectionIdentity {
  return { accountId: input.accountId, agent: input.agent, ownerLocale: OwnerLocale.PortugueseBrazil };
}
