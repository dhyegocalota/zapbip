import type { UsageRepository } from '../../operations/usage-repository';

const REPORT_DAY_STATEMENT = `INSERT INTO usage_daily (day, account_id, gigabyte_seconds) VALUES (?, ?, ?)
  ON CONFLICT (day, account_id) DO UPDATE SET gigabyte_seconds = excluded.gigabyte_seconds`;
const READ_DAY_TOTAL_STATEMENT = 'SELECT COALESCE(SUM(gigabyte_seconds), 0) AS total FROM usage_daily WHERE day = ?';

export class D1UsageRepository implements UsageRepository {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async reportDay(input: { day: string; accountId: string; gigabyteSeconds: number }): Promise<void> {
    await this.database.prepare(REPORT_DAY_STATEMENT).bind(input.day, input.accountId, input.gigabyteSeconds).run();
  }

  async readDayTotal(input: { day: string }): Promise<number> {
    const row = await this.database.prepare(READ_DAY_TOTAL_STATEMENT).bind(input.day).first<{ total: number }>();
    if (row === null) throw new Error('usage total query returned no row');
    return row.total;
  }
}
