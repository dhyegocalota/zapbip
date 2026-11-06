import type { AgentName, ConnectionRecord, ConnectionRegistry } from '@zapbip/core';
import type { RegisterOutcome } from '@zapbip/types';

export class D1ConnectionRegistry implements ConnectionRegistry {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async register(input: { connection: ConnectionRecord; activeLimit: number }): Promise<RegisterOutcome> {
    void input;
    void this.database;
    throw new Error('D1ConnectionRegistry.register is not implemented');
  }

  async findActiveByAgent(input: { accountId: string; agent: AgentName }): Promise<ConnectionRecord | null> {
    void input;
    throw new Error('D1ConnectionRegistry.findActiveByAgent is not implemented');
  }

  async listActive(input: { accountId: string }): Promise<ConnectionRecord[]> {
    void input;
    throw new Error('D1ConnectionRegistry.listActive is not implemented');
  }

  async revoke(input: { accountId: string; agent: AgentName; revokedAt: number }): Promise<boolean> {
    void input;
    throw new Error('D1ConnectionRegistry.revoke is not implemented');
  }

  async rotate(input: { accountId: string; agent: AgentName; fromDigest: string; toDigest: string; rotatedAt: number }): Promise<boolean> {
    void input;
    throw new Error('D1ConnectionRegistry.rotate is not implemented');
  }
}
