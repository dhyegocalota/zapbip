import { BACKOFFICE_LOCKOUT_MS, BACKOFFICE_LOCKOUT_THRESHOLD } from '../../contract/constants';

export type OperatorRow = { last_totp_step: number; failed_attempts: number; locked_until: number | null };
export type FailureRecord = { failedAttempts: number; lockedUntil: number | null };

const READ_OPERATOR_STATEMENT = 'SELECT last_totp_step, failed_attempts, locked_until FROM backoffice_operator WHERE id = 1';
const RECORD_SUCCESS_STATEMENT =
  'UPDATE backoffice_operator SET last_totp_step = ?, failed_attempts = 0 WHERE id = 1 AND last_totp_step < ?';
const RELEASE_EXPIRED_LOCK_STATEMENT =
  'UPDATE backoffice_operator SET failed_attempts = 0, locked_until = NULL WHERE id = 1 AND locked_until IS NOT NULL AND locked_until <= ?';
const RECORD_FAILURE_STATEMENT = `UPDATE backoffice_operator SET failed_attempts = failed_attempts + 1,
  locked_until = CASE WHEN failed_attempts + 1 >= ? THEN ? ELSE locked_until END
  WHERE id = 1 RETURNING failed_attempts, locked_until`;

export async function readOperator(input: { database: D1Database }): Promise<OperatorRow> {
  const row = await input.database.prepare(READ_OPERATOR_STATEMENT).first<OperatorRow>();
  if (row === null) throw new Error('the operator row is missing');
  return row;
}

export function isLocked(input: { operator: OperatorRow; now: number }): boolean {
  return input.operator.locked_until !== null && input.operator.locked_until > input.now;
}

export async function releaseExpiredLock(input: { database: D1Database; now: number }): Promise<void> {
  await input.database.prepare(RELEASE_EXPIRED_LOCK_STATEMENT).bind(input.now).run();
}

export async function recordSuccess(input: { database: D1Database; step: number }): Promise<boolean> {
  const result = await input.database.prepare(RECORD_SUCCESS_STATEMENT).bind(input.step, input.step).run();
  return result.meta.changes === 1;
}

export async function recordFailure(input: { database: D1Database; now: number }): Promise<FailureRecord> {
  const row = await input.database
    .prepare(RECORD_FAILURE_STATEMENT)
    .bind(BACKOFFICE_LOCKOUT_THRESHOLD, input.now + BACKOFFICE_LOCKOUT_MS)
    .first<{ failed_attempts: number; locked_until: number | null }>();
  if (row === null) throw new Error('the operator row is missing');
  return { failedAttempts: row.failed_attempts, lockedUntil: row.locked_until };
}
