import type { OwnerLocale } from '@zapbip/types';

export function findOwnerByPhone(input: {
  database: D1Database;
  phone: string;
}): Promise<{ accountId: string; ownerLocale: OwnerLocale } | null> {
  void input;
  throw new Error('findOwnerByPhone is not implemented');
}
