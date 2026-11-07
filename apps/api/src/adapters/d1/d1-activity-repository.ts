import type { ActivityRepository, ActivityEntry } from '../../operations/activity-repository';

const REPORT_STATEMENT = `INSERT INTO activity_daily (day, account_id, number_id, metric, count)
  SELECT ?, id, number_id, ?, ? FROM accounts WHERE id = ?
  ON CONFLICT (day, account_id, metric) DO UPDATE SET count = excluded.count, number_id = excluded.number_id`;

export class D1ActivityRepository implements ActivityRepository {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async reportActivity(input: { accountId: string; entries: ActivityEntry[] }): Promise<void> {
    const statements = input.entries.map((entry) =>
      this.database.prepare(REPORT_STATEMENT).bind(entry.day, entry.metric, entry.count, input.accountId),
    );
    await this.database.batch(statements);
  }
}
