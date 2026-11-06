import type { AccountDirectory, AccountLookup, AccountRecord } from '@zapbip/core';
import type { AccountState, OwnerLocale } from '@zapbip/types';

export class D1AccountDirectory implements AccountDirectory {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async findByWaId(input: { waId: string }): Promise<AccountRecord | null> {
    void input;
    void this.database;
    throw new Error('D1AccountDirectory.findByWaId is not implemented');
  }

  async findOrCreateByWaId(input: {
    waId: string;
    accountId: string;
    initialState: AccountState;
    locale: OwnerLocale;
    createdAt: number;
    newAccountsCap: { since: number; limit: number };
  }): Promise<AccountLookup | null> {
    void input;
    throw new Error('D1AccountDirectory.findOrCreateByWaId is not implemented');
  }

  async setState(input: { accountId: string; state: AccountState }): Promise<void> {
    void input;
    throw new Error('D1AccountDirectory.setState is not implemented');
  }

  async listByState(input: { state: AccountState }): Promise<AccountRecord[]> {
    void input;
    throw new Error('D1AccountDirectory.listByState is not implemented');
  }

  async remove(input: { accountId: string }): Promise<void> {
    void input;
    throw new Error('D1AccountDirectory.remove is not implemented');
  }
}
