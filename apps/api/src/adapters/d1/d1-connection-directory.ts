import type { ConnectionDirectory, ConnectionIdentity, ConnectionRecord } from '@zapbip/core';
import { AccountState } from '@zapbip/types';

export type ConnectionActivity = Pick<ConnectionRecord, 'connectionId' | 'clientName' | 'firstCallAt'>;

export type ConnectionWithActivity = { connection: ConnectionIdentity; activity: ConnectionActivity };

const RESOLVE_SECRET_DIGEST_STATEMENT = `SELECT connections.account_id AS accountId, connections.agent AS agent, owner_identities.locale AS ownerLocale,
  connections.id AS connectionId, connections.client_name AS clientName, connections.first_call_at AS firstCallAt
  FROM connections
  JOIN accounts ON accounts.id = connections.account_id
  JOIN owner_identities ON owner_identities.account_id = connections.account_id
  WHERE connections.secret_digest = ? AND connections.revoked_at IS NULL AND accounts.state = ?`;

type ConnectionRow = ConnectionIdentity & ConnectionActivity;

export class D1ConnectionDirectory implements ConnectionDirectory {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async resolveSecretDigest(input: { secretDigest: string }): Promise<ConnectionIdentity | null> {
    const resolved = await this.resolveWithActivity(input);
    if (resolved === null) return null;
    return resolved.connection;
  }

  async resolveWithActivity(input: { secretDigest: string }): Promise<ConnectionWithActivity | null> {
    const row = await this.database
      .prepare(RESOLVE_SECRET_DIGEST_STATEMENT)
      .bind(input.secretDigest, AccountState.Active)
      .first<ConnectionRow>();
    if (row === null) return null;
    const { accountId, agent, ownerLocale, connectionId, clientName, firstCallAt } = row;
    return { connection: { accountId, agent, ownerLocale }, activity: { connectionId, clientName, firstCallAt } };
  }
}
