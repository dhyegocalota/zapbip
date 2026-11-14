import type { OutboundGuard } from '@zapbip/core';
import { SenderVerdict } from '@zapbip/types';

const ACCOUNT_KEY_PREFIX = 'account:';

export function createAccountChangeGuard(input: { limiter: RateLimit }): OutboundGuard {
  return {
    async admit({ accountId, agentKey }) {
      const connectionOutcome = await input.limiter.limit({ key: agentKey });
      if (!connectionOutcome.success) return SenderVerdict.RateLimited;
      const accountOutcome = await input.limiter.limit({ key: `${ACCOUNT_KEY_PREFIX}${accountId}` });
      return accountOutcome.success ? SenderVerdict.Admitted : SenderVerdict.RateLimited;
    },
  };
}
