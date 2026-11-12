import type { WaitlistListRow } from './waitlist-csv';

export const NO_ROW_LIMIT = -1;

const COUNT_STATEMENT = 'SELECT COUNT(*) AS total FROM landing_waitlist';
const LIST_STATEMENT = `SELECT me.email AS email, me.created_at AS joinedAt, referrer.email AS referredByEmail,
  (SELECT COUNT(*) FROM landing_waitlist WHERE referred_by = me.referral_code AND credited = 1) AS creditedCount
FROM landing_waitlist AS me LEFT JOIN landing_waitlist AS referrer ON referrer.referral_code = me.referred_by
ORDER BY creditedCount DESC, me.created_at ASC, me.rowid ASC LIMIT ?`;

export async function countWaitlist(input: { database: D1Database }): Promise<number> {
  const row = await input.database.prepare(COUNT_STATEMENT).first<{ total: number }>();
  if (row === null) throw new Error('the waitlist count returned no row');
  return row.total;
}

export async function listWaitlist(input: { database: D1Database; limit: number }): Promise<WaitlistListRow[]> {
  const { results } = await input.database.prepare(LIST_STATEMENT).bind(input.limit).all<WaitlistListRow>();
  return results;
}
