import type { OutboundGuard } from '@zapbip/core';
import type { SenderVerdict } from '@zapbip/types';

export function createOutboundGuard(input: { connectionLimiter: RateLimit; accountLimiter: RateLimit }): OutboundGuard {
  return {
    async admit(admission: { accountId: string; connectionId: string }): Promise<SenderVerdict> {
      void admission;
      void input;
      throw new Error('OutboundGuard.admit is not implemented');
    },
  };
}
