import type { AgentName, ConnectionRecord, ConnectionRegistry, InstallCodeColumns, NewConnection } from '@zapbip/core';
import { RegisterOutcome } from '@zapbip/types';

const SELECT_CONNECTION = `SELECT id AS connectionId, account_id AS accountId, agent, secret_digest AS secretDigest, created_at AS createdAt
  FROM connections`;
const FIND_ACTIVE_BY_AGENT_STATEMENT = SELECT_CONNECTION + ' WHERE account_id = ? AND agent = ? AND revoked_at IS NULL';
const LIST_ACTIVE_STATEMENT = SELECT_CONNECTION + ' WHERE account_id = ? AND revoked_at IS NULL ORDER BY created_at, id';
const REGISTER_STATEMENT = `INSERT INTO connections (id, account_id, agent, secret_digest, created_at)
  SELECT ?, ?, ?, ?, ?
  WHERE (SELECT COUNT(*) FROM connections WHERE account_id = ? AND revoked_at IS NULL) < ?`;
const REVOKE_STATEMENT = 'UPDATE connections SET revoked_at = ? WHERE account_id = ? AND agent = ? AND revoked_at IS NULL';
const ROTATE_STATEMENT = `UPDATE connections SET secret_digest = ?, rotated_at = ?
  WHERE account_id = ? AND agent = ? AND secret_digest = ? AND revoked_at IS NULL`;
const SINGLE_CHANGE = 1;

export class D1ConnectionRegistry implements ConnectionRegistry {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async register(input: { connection: NewConnection; activeLimit: number }): Promise<RegisterOutcome> {
    const { connection } = input;
    const result = await this.database
      .prepare(REGISTER_STATEMENT)
      .bind(
        connection.connectionId,
        connection.accountId,
        connection.agent,
        connection.secretDigest,
        connection.createdAt,
        connection.accountId,
        input.activeLimit,
      )
      .run()
      .catch(async (error: unknown) => {
        const holder = await this.findActiveByAgent({ accountId: connection.accountId, agent: connection.agent });
        if (holder === null) throw error;
        return null;
      });
    if (result === null) return RegisterOutcome.NameTaken;
    if (result.meta.changes === SINGLE_CHANGE) return RegisterOutcome.Registered;
    return RegisterOutcome.LimitReached;
  }

  findActiveByAgent(input: { accountId: string; agent: AgentName }): Promise<ConnectionRecord | null> {
    return this.database.prepare(FIND_ACTIVE_BY_AGENT_STATEMENT).bind(input.accountId, input.agent).first<ConnectionRecord>();
  }

  async listActive(input: { accountId: string }): Promise<ConnectionRecord[]> {
    const rows = await this.database.prepare(LIST_ACTIVE_STATEMENT).bind(input.accountId).all<ConnectionRecord>();
    return rows.results;
  }

  async revoke(input: { accountId: string; agent: AgentName; revokedAt: number }): Promise<boolean> {
    const result = await this.database.prepare(REVOKE_STATEMENT).bind(input.revokedAt, input.accountId, input.agent).run();
    return result.meta.changes === SINGLE_CHANGE;
  }

  async rotate(input: {
    accountId: string;
    agent: AgentName;
    fromDigest: string;
    toDigest: string;
    installCode: InstallCodeColumns;
    rotatedAt: number;
  }): Promise<boolean> {
    const result = await this.database
      .prepare(ROTATE_STATEMENT)
      .bind(input.toDigest, input.rotatedAt, input.accountId, input.agent, input.fromDigest)
      .run();
    return result.meta.changes === SINGLE_CHANGE;
  }
}
