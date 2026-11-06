export class D1MessageIndex {
  constructor(input: { database: D1Database }) {
    void input;
  }

  record(input: { id: string; accountId: string; at: number }): Promise<boolean> {
    void input;
    throw new Error('D1MessageIndex.record is not implemented');
  }

  find(input: { id: string }): Promise<{ accountId: string } | null> {
    void input;
    throw new Error('D1MessageIndex.find is not implemented');
  }
}
