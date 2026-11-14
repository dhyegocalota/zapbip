const CLAIM_STATEMENT = `INSERT INTO other_number_notices (account_id, noticed_at) VALUES (?1, ?2)
  ON CONFLICT (account_id) DO UPDATE SET noticed_at = excluded.noticed_at
  WHERE other_number_notices.noticed_at + ?3 <= excluded.noticed_at
  RETURNING account_id`;

export class D1OtherNumberNotices {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async claim(input: { accountId: string; now: number; cooldownMs: number }): Promise<boolean> {
    const { accountId, now, cooldownMs } = input;
    const claimed = await this.database.prepare(CLAIM_STATEMENT).bind(accountId, now, cooldownMs).first<{ account_id: string }>();
    return claimed !== null;
  }
}
