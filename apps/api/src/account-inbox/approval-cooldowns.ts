import type { ApprovalCooldowns } from '@zapbip/core';

const COOLDOWN_KEY_PREFIX = 'approval_cooldown:';

export function createStorageApprovalCooldowns(input: { storage: DurableObjectStorage; now: () => number }): ApprovalCooldowns {
  const { storage, now } = input;
  return {
    isCoolingDown: async ({ key, now: at }) => {
      const until = await storage.get<number>(`${COOLDOWN_KEY_PREFIX}${key}`);
      return until !== undefined && until > at;
    },
    start: async ({ key, until }) => {
      const stored = await storage.list<number>({ prefix: COOLDOWN_KEY_PREFIX });
      const expired = [...stored].filter(([, expiresAt]) => expiresAt <= now()).map(([storedKey]) => storedKey);
      await storage.delete(expired);
      await storage.put(`${COOLDOWN_KEY_PREFIX}${key}`, until);
    },
  };
}
