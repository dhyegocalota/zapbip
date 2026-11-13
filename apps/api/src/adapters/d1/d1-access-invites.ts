import type { AccessInvites } from '@zapbip/core';

export class D1AccessInvites implements AccessInvites {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async issue(input: { email: string; now: number }): Promise<string> {
    throw new Error('D1AccessInvites.issue is not implemented');
  }

  async consume(input: { code: string; now: number }): Promise<boolean> {
    throw new Error('D1AccessInvites.consume is not implemented');
  }
}
