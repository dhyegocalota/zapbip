import { BACKOFFICE_LOCKOUT_MS, BACKOFFICE_LOCKOUT_THRESHOLD } from '../../contract/constants';

export enum FailureCounter {
  Code = 'code',
  Password = 'password',
}

export type OperatorRow = {
  last_totp_step: number;
  failed_attempts: number;
  locked_until: number | null;
  password_failed_attempts: number;
  password_locked_until: number | null;
  email: string | null;
  password_hash: string | null;
};
export type FailureRecord = { failedAttempts: number; lockedUntil: number | null };

type CounterStatements = { releaseExpiredLock: string; recordFailure: string; lockedUntilColumn: 'locked_until' | 'password_locked_until' };

const COUNTER_STATEMENTS: Record<FailureCounter, CounterStatements> = {
  [FailureCounter.Code]: {
    lockedUntilColumn: 'locked_until',
    releaseExpiredLock:
      'UPDATE backoffice_operator SET failed_attempts = 0, locked_until = NULL WHERE id = 1 AND locked_until IS NOT NULL AND locked_until <= ?',
    recordFailure: `UPDATE backoffice_operator SET failed_attempts = failed_attempts + 1,
  locked_until = CASE WHEN failed_attempts + 1 >= ? THEN ? ELSE locked_until END
  WHERE id = 1 RETURNING failed_attempts, locked_until`,
  },
  [FailureCounter.Password]: {
    lockedUntilColumn: 'password_locked_until',
    releaseExpiredLock:
      'UPDATE backoffice_operator SET password_failed_attempts = 0, password_locked_until = NULL WHERE id = 1 AND password_locked_until IS NOT NULL AND password_locked_until <= ?',
    recordFailure: `UPDATE backoffice_operator SET password_failed_attempts = password_failed_attempts + 1,
  password_locked_until = CASE WHEN password_failed_attempts + 1 >= ? THEN ? ELSE password_locked_until END
  WHERE id = 1 RETURNING password_failed_attempts AS failed_attempts, password_locked_until AS locked_until`,
  },
};
const READ_OPERATOR_STATEMENT =
  'SELECT last_totp_step, failed_attempts, locked_until, password_failed_attempts, password_locked_until, email, password_hash FROM backoffice_operator WHERE id = 1';
const RECORD_SUCCESS_STATEMENT =
  'UPDATE backoffice_operator SET last_totp_step = ?, failed_attempts = 0 WHERE id = 1 AND last_totp_step < ?';
const RESET_PASSWORD_FAILURES_STATEMENT = 'UPDATE backoffice_operator SET password_failed_attempts = 0 WHERE id = 1';

export async function readOperator(input: { database: D1Database }): Promise<OperatorRow> {
  const row = await input.database.prepare(READ_OPERATOR_STATEMENT).first<OperatorRow>();
  if (row === null) throw new Error('the operator row is missing');
  return row;
}

export function isLocked(input: { operator: OperatorRow; now: number; counter: FailureCounter }): boolean {
  const lockedUntil = input.operator[COUNTER_STATEMENTS[input.counter].lockedUntilColumn];
  return lockedUntil !== null && lockedUntil > input.now;
}

export async function releaseExpiredLock(input: { database: D1Database; now: number; counter: FailureCounter }): Promise<void> {
  await input.database.prepare(COUNTER_STATEMENTS[input.counter].releaseExpiredLock).bind(input.now).run();
}

export async function recordSuccess(input: { database: D1Database; step: number }): Promise<boolean> {
  const result = await input.database.prepare(RECORD_SUCCESS_STATEMENT).bind(input.step, input.step).run();
  return result.meta.changes === 1;
}

export async function resetPasswordFailures(input: { database: D1Database }): Promise<void> {
  await input.database.prepare(RESET_PASSWORD_FAILURES_STATEMENT).run();
}

export async function recordFailure(input: { database: D1Database; now: number; counter: FailureCounter }): Promise<FailureRecord> {
  const row = await input.database
    .prepare(COUNTER_STATEMENTS[input.counter].recordFailure)
    .bind(BACKOFFICE_LOCKOUT_THRESHOLD, input.now + BACKOFFICE_LOCKOUT_MS)
    .first<{ failed_attempts: number; locked_until: number | null }>();
  if (row === null) throw new Error('the operator row is missing');
  return { failedAttempts: row.failed_attempts, lockedUntil: row.locked_until };
}
