import type { OutboundGuard } from '@zapbip/core';
import { SenderVerdict } from '@zapbip/types';

export function createAccountChangeGuard(input: { limiter: RateLimit }): OutboundGuard {
  return {
    async admit({ agentKey }) {
      const outcome = await input.limiter.limit({ key: agentKey });
      return outcome.success ? SenderVerdict.Admitted : SenderVerdict.RateLimited;
    },
  };
}
