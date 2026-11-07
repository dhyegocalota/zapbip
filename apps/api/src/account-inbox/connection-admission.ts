import { AccountState } from '@zapbip/types';
import type { ConnectionIdentity } from '@zapbip/core';

const ADMISSION_STATEMENT = `SELECT
  (SELECT state FROM accounts WHERE id = ?1) AS state,
  EXISTS (SELECT 1 FROM connections WHERE account_id = ?1 AND agent = ?2 AND revoked_at IS NULL) AS hasActive,
  EXISTS (SELECT 1 FROM connections WHERE account_id = ?1 AND agent = ?2 AND revoked_at IS NOT NULL) AS hasRevoked`;
const STATE_STATEMENT = 'SELECT state FROM accounts WHERE id = ?';

const ADMISSION_ROW_MISSING_MESSAGE = 'admission: the query returned no row';

type AdmissionRow = { state: AccountState | null; hasActive: number; hasRevoked: number };

export async function isAccountActive(input: { database: D1Database; accountId: string }): Promise<boolean> {
  const row = await input.database.prepare(STATE_STATEMENT).bind(input.accountId).first<{ state: AccountState }>();
  return row !== null && row.state === AccountState.Active;
}

export async function isConnectionAdmitted(input: { database: D1Database; connection: ConnectionIdentity }): Promise<boolean> {
  const { accountId, agent } = input.connection;
  const row = await input.database.prepare(ADMISSION_STATEMENT).bind(accountId, agent).first<AdmissionRow>();
  if (row === null) throw new Error(ADMISSION_ROW_MISSING_MESSAGE);
  const isAccountBlocked = row.state !== AccountState.Active;
  const isRevokedWithoutSuccessor = row.hasActive === 0 && row.hasRevoked === 1;
  return !isAccountBlocked && !isRevokedWithoutSuccessor;
}
