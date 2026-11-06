import type { SenderGuard } from '@zapbip/core';
import type { SenderVerdict } from '@zapbip/types';

export function createSenderGuard(input: { database: D1Database; limiter: RateLimit }): SenderGuard {
  return {
    async admit({ waId }: { waId: string }): Promise<SenderVerdict> {
      void waId;
      void input;
      throw new Error('SenderGuard.admit is not implemented');
    },
  };
}
