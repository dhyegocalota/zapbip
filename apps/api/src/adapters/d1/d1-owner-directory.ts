import type { OwnerLocale } from '@zapbip/types';

export type OwnerRecipient = { waId: string; ownerLocale: OwnerLocale };

export function findOwnerByPhone(input: {
  database: D1Database;
  phone: string;
}): Promise<{ accountId: string; ownerLocale: OwnerLocale } | null> {
  void input;
  throw new Error('findOwnerByPhone is not implemented');
}

export function findOwnerByAccountId(input: { database: D1Database; accountId: string }): Promise<OwnerRecipient | null> {
  void input;
  throw new Error('findOwnerByAccountId is not implemented');
}
