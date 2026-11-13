import type { AccessInvites } from '@zapbip/core';

export class D1AccessInvites implements AccessInvites {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async issueMany(input: { emails: string[]; now: number }): Promise<(string | null)[]> {
    throw new Error('D1AccessInvites.issueMany is not implemented');
  }

  async redeem(input: { code: string; accountId: string; now: number }): Promise<boolean> {
    throw new Error('D1AccessInvites.redeem is not implemented');
  }
}
