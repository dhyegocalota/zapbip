import { InboxError } from '@zapbip/core';
import { ChannelErrorKind, SenderVerdict } from '@zapbip/types';
import { OUTBOUND_RATE_LIMITED_MESSAGE } from './constants';
import type { ToolContext } from './types';

export async function assertOutboundAdmitted(input: { context: ToolContext }): Promise<void> {
  const { connection, outboundGuard } = input.context;
  const verdict = await outboundGuard.admit({
    accountId: connection.accountId,
    agentKey: `${connection.accountId}:${connection.agent}`,
  });
  if (verdict === SenderVerdict.Admitted) return;
  throw new InboxError({ code: ChannelErrorKind.RateLimited, message: OUTBOUND_RATE_LIMITED_MESSAGE });
}
