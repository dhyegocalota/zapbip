import type { OwnerLocale } from '@zapbip/types';
import { filterBefore, filterSince, type AccessFilter } from '../access/access-filter';
import type { BackofficeAuditAction, BackofficeAuditOutcome } from '../audit/backoffice-audit-action';

export type WaitlistPageRow = { entryId: string; joinedAt: number; locale: OwnerLocale; creditedCount: number };
export type AuditPageRow = {
  at: number;
  action: BackofficeAuditAction;
  targetKind: string | null;
  targetId: string | null;
  outcome: BackofficeAuditOutcome;
  actorKeyId: string | null;
};

const WAITLIST_SCOPE =
  'FROM landing_waitlist AS me WHERE (?1 IS NULL OR me.created_at >= ?1) AND (?2 IS NULL OR me.created_at < ?2) AND (?3 IS NULL OR me.locale = ?3)';
const LIST_WAITLIST_STATEMENT =
  'SELECT me.email AS entryId, me.created_at AS joinedAt, me.locale AS locale, ' +
  '(SELECT COUNT(*) FROM landing_waitlist WHERE referred_by = me.referral_code AND credited = 1) AS creditedCount ' +
  WAITLIST_SCOPE +
  ' ORDER BY me.created_at, me.rowid LIMIT ?4 OFFSET ?5';
const COUNT_WAITLIST_STATEMENT = 'SELECT COUNT(*) AS total ' + WAITLIST_SCOPE;
const LIST_AUDIT_STATEMENT =
  'SELECT at, action, target_kind AS targetKind, target_id AS targetId, outcome, actor_key_id AS actorKeyId FROM backoffice_audit ORDER BY at DESC, rowid DESC LIMIT ?';

function scopeBindings(input: { filter: AccessFilter }): (string | number | null)[] {
  const { filter } = input;
  return [filterSince({ filter }), filterBefore({ filter }), filter.locale];
}

export async function listWaitlistPage(input: {
  database: D1Database;
  filter: AccessFilter;
  limit: number;
  offset: number;
}): Promise<WaitlistPageRow[]> {
  const { database, filter, limit, offset } = input;
  const { results } = await database
    .prepare(LIST_WAITLIST_STATEMENT)
    .bind(...scopeBindings({ filter }), limit, offset)
    .all<WaitlistPageRow>();
  return results;
}

export async function countWaitlistPage(input: { database: D1Database; filter: AccessFilter }): Promise<number> {
  const row = await input.database
    .prepare(COUNT_WAITLIST_STATEMENT)
    .bind(...scopeBindings({ filter: input.filter }))
    .first<{ total: number }>();
  if (row === null) throw new Error('the waitlist count returned no row');
  return row.total;
}

export async function listAuditPage(input: { database: D1Database; limit: number }): Promise<AuditPageRow[]> {
  const { results } = await input.database.prepare(LIST_AUDIT_STATEMENT).bind(input.limit).all<AuditPageRow>();
  return results;
}
