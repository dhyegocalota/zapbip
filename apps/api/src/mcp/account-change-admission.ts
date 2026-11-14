import { connectionKeyOf, InboxError } from '@zapbip/core';
import { ChannelErrorKind, SenderVerdict } from '@zapbip/types';
import { ACCOUNT_CHANGE_RATE_LIMITED_MESSAGE } from './constants';
import type { ToolContext } from './types';

export async function assertAccountChangeAdmitted(input: { context: ToolContext }): Promise<void> {
  const { connection, accountChangeGuard } = input.context;
  const verdict = await accountChangeGuard.admit({
    accountId: connection.accountId,
    agentKey: connectionKeyOf({ connection }),
  });
  if (verdict === SenderVerdict.Admitted) return;
  throw new InboxError({ code: ChannelErrorKind.RateLimited, message: ACCOUNT_CHANGE_RATE_LIMITED_MESSAGE });
}
