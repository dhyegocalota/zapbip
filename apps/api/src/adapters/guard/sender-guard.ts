import type { SenderGuard } from '@zapbip/core';
import { SenderVerdict } from '@zapbip/types';

const IS_BLOCKED_STATEMENT = 'SELECT 1 AS blocked FROM blocked_phones WHERE wa_id = ?';

export function createSenderGuard(input: { database: D1Database; limiter: RateLimit }): SenderGuard {
  return {
    async admit({ waId }) {
      const blocked = await input.database.prepare(IS_BLOCKED_STATEMENT).bind(waId).first();
      if (blocked !== null) return SenderVerdict.Blocked;
      const outcome = await input.limiter.limit({ key: waId });
      if (!outcome.success) return SenderVerdict.RateLimited;
      return SenderVerdict.Admitted;
    },
  };
}
