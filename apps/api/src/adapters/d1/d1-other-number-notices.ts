const FIND_NOTICED_AT_STATEMENT = 'SELECT noticed_at AS noticedAt FROM other_number_notices WHERE account_id = ?';
const RECORD_STATEMENT = `INSERT INTO other_number_notices (account_id, noticed_at) VALUES (?1, ?2)
  ON CONFLICT (account_id) DO UPDATE SET noticed_at = excluded.noticed_at`;

export class D1OtherNumberNotices {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async isCoolingDown(input: { accountId: string; now: number; cooldownMs: number }): Promise<boolean> {
    const { accountId, now, cooldownMs } = input;
    const row = await this.database.prepare(FIND_NOTICED_AT_STATEMENT).bind(accountId).first<{ noticedAt: number }>();
    if (row === null) return false;
    return row.noticedAt + cooldownMs > now;
  }

  async record(input: { accountId: string; noticedAt: number }): Promise<void> {
    await this.database.prepare(RECORD_STATEMENT).bind(input.accountId, input.noticedAt).run();
  }

  async claim(input: { accountId: string; now: number; cooldownMs: number }): Promise<boolean> {
    throw new Error(`claim is not implemented for ${input.accountId}`);
  }
}
