import { AccountState, type OwnerLocale } from '@zapbip/types';
import { filterBefore, filterSince, type AccessFilter } from './access-filter';

export type WaitingAccountRow = { accountId: string; waId: string; joinedAt: number; locale: OwnerLocale };
export type InvitableEntryRow = { email: string; joinedAt: number; locale: OwnerLocale };

const ACCOUNT_SCOPE =
  'FROM accounts JOIN owner_identities ON owner_identities.account_id = accounts.id ' +
  'WHERE accounts.state = ?1 AND (?2 IS NULL OR accounts.created_at >= ?2) AND (?3 IS NULL OR accounts.created_at < ?3) ' +
  'AND (?4 IS NULL OR owner_identities.locale = ?4)';
const ENTRY_SCOPE =
  'FROM landing_waitlist AS entry WHERE NOT EXISTS (SELECT 1 FROM waitlist_invites AS invite ' +
  'WHERE invite.email = entry.email AND (invite.used_at IS NOT NULL OR invite.expires_at > ?1)) ' +
  'AND (?2 IS NULL OR entry.created_at >= ?2) AND (?3 IS NULL OR entry.created_at < ?3) AND (?4 IS NULL OR entry.locale = ?4)';

const LIST_ACCOUNTS_STATEMENT =
  'SELECT accounts.id AS accountId, owner_identities.wa_id AS waId, accounts.created_at AS joinedAt, owner_identities.locale AS locale ' +
  ACCOUNT_SCOPE +
  ' ORDER BY accounts.created_at, accounts.id LIMIT ?5';
const COUNT_ACCOUNTS_STATEMENT = 'SELECT COUNT(*) AS total ' + ACCOUNT_SCOPE;
const LIST_ENTRIES_STATEMENT =
  'SELECT entry.email AS email, entry.created_at AS joinedAt, entry.locale AS locale ' +
  ENTRY_SCOPE +
  ' ORDER BY entry.created_at, entry.rowid LIMIT ?5';
const COUNT_ENTRIES_STATEMENT = 'SELECT COUNT(*) AS total ' + ENTRY_SCOPE;
const FIND_ENTRIES_STATEMENT = 'SELECT email, created_at AS joinedAt, locale FROM landing_waitlist WHERE email = ?';

type Scope = { database: D1Database; filter: AccessFilter };

function scopeBindings(input: { filter: AccessFilter; lead: string | number }): (string | number | null)[] {
  const { filter, lead } = input;
  return [lead, filterSince({ filter }), filterBefore({ filter }), filter.locale];
}

async function totalOf(input: { statement: D1PreparedStatement }): Promise<number> {
  const row = await input.statement.first<{ total: number }>();
  if (row === null) throw new Error('an access count returned no row');
  return row.total;
}

export async function listWaitingAccounts(input: Scope & { limit: number }): Promise<WaitingAccountRow[]> {
  const bindings = [...scopeBindings({ filter: input.filter, lead: AccountState.Waitlisted }), input.limit];
  const { results } = await input.database
    .prepare(LIST_ACCOUNTS_STATEMENT)
    .bind(...bindings)
    .all<WaitingAccountRow>();
  return results;
}

export function countWaitingAccounts(input: Scope): Promise<number> {
  const bindings = scopeBindings({ filter: input.filter, lead: AccountState.Waitlisted });
  return totalOf({ statement: input.database.prepare(COUNT_ACCOUNTS_STATEMENT).bind(...bindings) });
}

export async function listInvitableEntries(input: Scope & { now: number; limit: number }): Promise<InvitableEntryRow[]> {
  const bindings = [...scopeBindings({ filter: input.filter, lead: input.now }), input.limit];
  const { results } = await input.database
    .prepare(LIST_ENTRIES_STATEMENT)
    .bind(...bindings)
    .all<InvitableEntryRow>();
  return results;
}

export function countInvitableEntries(input: Scope & { now: number }): Promise<number> {
  const bindings = scopeBindings({ filter: input.filter, lead: input.now });
  return totalOf({ statement: input.database.prepare(COUNT_ENTRIES_STATEMENT).bind(...bindings) });
}

export async function findWaitlistEntries(input: { database: D1Database; emails: string[] }): Promise<InvitableEntryRow[]> {
  const batches = await input.database.batch<InvitableEntryRow>(
    input.emails.map((email) => input.database.prepare(FIND_ENTRIES_STATEMENT).bind(email)),
  );
  return batches.flatMap((batch) => batch.results);
}
