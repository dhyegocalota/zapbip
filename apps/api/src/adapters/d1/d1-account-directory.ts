import type { AccountDirectory, AccountLookup, AccountRecord } from '@zapbip/core';
import type { AccountState, OwnerLocale } from '@zapbip/types';
import { LogEvent } from '../../contract/log';
import { logEvent } from '../../log';

const SELECT_ACCOUNT = `SELECT accounts.id AS accountId, owner_identities.wa_id AS waId, accounts.state AS state, owner_identities.locale AS locale,
  accounts.number_id AS homeNumberId
  FROM owner_identities
  JOIN accounts ON accounts.id = owner_identities.account_id`;
const FIND_BY_WA_ID_STATEMENT = SELECT_ACCOUNT + ' WHERE owner_identities.wa_id = ?';
const LIST_BY_STATE_STATEMENT = SELECT_ACCOUNT + ' WHERE accounts.state = ? ORDER BY accounts.created_at, accounts.id';
const CREATE_ACCOUNT_STATEMENT = `INSERT INTO accounts (id, state, created_at, number_id)
  SELECT ?, ?, ?, ?
  WHERE NOT EXISTS (SELECT 1 FROM owner_identities WHERE wa_id = ?)
  AND (SELECT COUNT(*) FROM accounts WHERE created_at > ?) < ?`;
const CREATE_IDENTITY_STATEMENT = `INSERT INTO owner_identities (wa_id, account_id, from_user_id, locale, created_at)
  SELECT ?, ?, NULL, ?, ?
  WHERE EXISTS (SELECT 1 FROM accounts WHERE id = ?)
  ON CONFLICT (wa_id) DO NOTHING`;
const SET_STATE_STATEMENT = 'UPDATE accounts SET state = ? WHERE id = ?';
const REMOVE_STATEMENTS = [
  'DELETE FROM client_app_sessions WHERE account_id = ?',
  'DELETE FROM client_app_sign_in_tokens WHERE account_id = ?',
  'DELETE FROM message_index WHERE account_id = ?',
  'DELETE FROM owner_identities WHERE account_id = ?',
  'DELETE FROM connections WHERE account_id = ?',
  'DELETE FROM accounts WHERE id = ?',
];
const ACCOUNT_CREATED_CHANGES = 1;

export class D1AccountDirectory implements AccountDirectory {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  findByWaId(input: { waId: string }): Promise<AccountRecord | null> {
    return this.database.prepare(FIND_BY_WA_ID_STATEMENT).bind(input.waId).first<AccountRecord>();
  }

  async findOrCreateByWaId(input: {
    waId: string;
    accountId: string;
    initialState: AccountState;
    locale: OwnerLocale;
    homeNumberId: string;
    createdAt: number;
    newAccountsCap: { since: number; limit: number };
  }): Promise<AccountLookup | null> {
    const [accountInsert] = await this.database.batch([
      this.database
        .prepare(CREATE_ACCOUNT_STATEMENT)
        .bind(
          input.accountId,
          input.initialState,
          input.createdAt,
          input.homeNumberId,
          input.waId,
          input.newAccountsCap.since,
          input.newAccountsCap.limit,
        ),
      this.database.prepare(CREATE_IDENTITY_STATEMENT).bind(input.waId, input.accountId, input.locale, input.createdAt, input.accountId),
    ]);
    const account = await this.findByWaId({ waId: input.waId });
    if (account === null) return null;
    return { account, created: accountInsert?.meta.changes === ACCOUNT_CREATED_CHANGES };
  }

  async setState(input: { accountId: string; state: AccountState }): Promise<void> {
    await this.database.prepare(SET_STATE_STATEMENT).bind(input.state, input.accountId).run();
    logEvent({ event: LogEvent.AccountStateChanged, accountId: input.accountId });
  }

  async listByState(input: { state: AccountState }): Promise<AccountRecord[]> {
    const rows = await this.database.prepare(LIST_BY_STATE_STATEMENT).bind(input.state).all<AccountRecord>();
    return rows.results;
  }

  async remove(input: { accountId: string }): Promise<void> {
    await this.database.batch(REMOVE_STATEMENTS.map((statement) => this.database.prepare(statement).bind(input.accountId)));
  }
}
