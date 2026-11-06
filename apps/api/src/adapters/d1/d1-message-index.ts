const RECORD_STATEMENT = 'INSERT OR IGNORE INTO message_index (wamid, account_id, created_at) VALUES (?, ?, ?)';
const FIND_STATEMENT = 'SELECT account_id AS accountId FROM message_index WHERE wamid = ?';

export class D1MessageIndex {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async record(input: { id: string; accountId: string; at: number }): Promise<boolean> {
    const result = await this.database.prepare(RECORD_STATEMENT).bind(input.id, input.accountId, input.at).run();
    return result.meta.changes === 1;
  }

  find(input: { id: string }): Promise<{ accountId: string } | null> {
    return this.database.prepare(FIND_STATEMENT).bind(input.id).first<{ accountId: string }>();
  }
}
