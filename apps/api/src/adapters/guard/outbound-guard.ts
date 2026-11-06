import type { OutboundGuard } from '@zapbip/core';
import { SenderVerdict } from '@zapbip/types';

export function createOutboundGuard(input: { connectionLimiter: RateLimit; accountLimiter: RateLimit }): OutboundGuard {
  return {
    async admit({ accountId, connectionId }) {
      const connectionOutcome = await input.connectionLimiter.limit({ key: connectionId });
      if (!connectionOutcome.success) return SenderVerdict.RateLimited;
      const accountOutcome = await input.accountLimiter.limit({ key: accountId });
      if (!accountOutcome.success) return SenderVerdict.RateLimited;
      return SenderVerdict.Admitted;
    },
  };
}
