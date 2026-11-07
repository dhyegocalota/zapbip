export type OperatorRow = { last_totp_step: number; failed_attempts: number; locked_until: number | null };

const READ_OPERATOR_STATEMENT = 'SELECT last_totp_step, failed_attempts, locked_until FROM backoffice_operator WHERE id = 1';
const RECORD_SUCCESS_STATEMENT = 'UPDATE backoffice_operator SET last_totp_step = ?, failed_attempts = 0 WHERE id = 1';
const RECORD_FAILURE_STATEMENT = 'UPDATE backoffice_operator SET failed_attempts = failed_attempts + 1 WHERE id = 1';

export async function readOperator(input: { database: D1Database }): Promise<OperatorRow> {
  const row = await input.database.prepare(READ_OPERATOR_STATEMENT).first<OperatorRow>();
  if (row === null) throw new Error('the operator row is missing');
  return row;
}

export async function recordSuccess(input: { database: D1Database; step: number }): Promise<void> {
  await input.database.prepare(RECORD_SUCCESS_STATEMENT).bind(input.step).run();
}

export async function recordFailure(input: { database: D1Database }): Promise<void> {
  await input.database.prepare(RECORD_FAILURE_STATEMENT).run();
}
