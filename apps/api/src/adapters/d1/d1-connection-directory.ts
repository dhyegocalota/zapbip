import type { ConnectionDirectory, ConnectionIdentity } from '@zapbip/core';
import { AccountState, type OwnerLocale } from '@zapbip/types';

const RESOLVE_SECRET_DIGEST_STATEMENT = `SELECT connections.account_id AS accountId, connections.agent AS agent, owner_identities.locale AS ownerLocale
  FROM connections
  JOIN accounts ON accounts.id = connections.account_id
  JOIN owner_identities ON owner_identities.account_id = connections.account_id
  WHERE connections.secret_digest = ? AND connections.revoked_at IS NULL AND accounts.state = ?`;

type ConnectionRow = { accountId: string; agent: string; ownerLocale: OwnerLocale };

export class D1ConnectionDirectory implements ConnectionDirectory {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  resolveSecretDigest(input: { secretDigest: string }): Promise<ConnectionIdentity | null> {
    return this.database.prepare(RESOLVE_SECRET_DIGEST_STATEMENT).bind(input.secretDigest, AccountState.Active).first<ConnectionRow>();
  }
}
