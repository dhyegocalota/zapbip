import type { OwnerLocale } from '@zapbip/types';

const FIND_OWNER_STATEMENT = 'SELECT account_id AS accountId, locale AS ownerLocale FROM owner_identities WHERE wa_id = ?';

export function findOwnerByPhone(input: {
  database: D1Database;
  phone: string;
}): Promise<{ accountId: string; ownerLocale: OwnerLocale } | null> {
  return input.database.prepare(FIND_OWNER_STATEMENT).bind(input.phone).first<{ accountId: string; ownerLocale: OwnerLocale }>();
}
