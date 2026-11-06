import { OwnerLocale } from '@zapbip/types';

export type OwnerRecipient = { waId: string; ownerLocale: OwnerLocale };
type OwnerRow = { accountId: string; waId: string; locale: string };

const FIND_BY_PHONE_STATEMENT = 'SELECT account_id AS accountId, wa_id AS waId, locale FROM owner_identities WHERE wa_id = ?';
const FIND_BY_ACCOUNT_STATEMENT = 'SELECT account_id AS accountId, wa_id AS waId, locale FROM owner_identities WHERE account_id = ?';
const OWNER_LOCALES: string[] = Object.values(OwnerLocale);

function isOwnerLocale(locale: string): locale is OwnerLocale {
  return OWNER_LOCALES.includes(locale);
}

function toOwnerLocale(input: { locale: string }): OwnerLocale {
  if (!isOwnerLocale(input.locale)) throw new Error(`owner_identities.locale is not an owner locale: ${input.locale}`);
  return input.locale;
}

export async function findOwnerByPhone(input: {
  database: D1Database;
  phone: string;
}): Promise<{ accountId: string; ownerLocale: OwnerLocale } | null> {
  const row = await input.database.prepare(FIND_BY_PHONE_STATEMENT).bind(input.phone).first<OwnerRow>();
  if (row === null) return null;
  return { accountId: row.accountId, ownerLocale: toOwnerLocale({ locale: row.locale }) };
}

export async function findOwnerByAccountId(input: { database: D1Database; accountId: string }): Promise<OwnerRecipient | null> {
  const row = await input.database.prepare(FIND_BY_ACCOUNT_STATEMENT).bind(input.accountId).first<OwnerRow>();
  if (row === null) return null;
  return { waId: row.waId, ownerLocale: toOwnerLocale({ locale: row.locale }) };
}
