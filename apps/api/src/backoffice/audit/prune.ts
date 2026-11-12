import { BACKOFFICE_AUDIT_RETENTION_MS } from '../../contract/constants';

const DELETE_EXPIRED_SESSIONS_STATEMENT = 'DELETE FROM backoffice_sessions WHERE expires_at <= ?';
const DELETE_EXPIRED_PENDING_SIGN_INS_STATEMENT = 'DELETE FROM backoffice_pending_sign_ins WHERE expires_at <= ?';
const DELETE_OLD_AUDIT_STATEMENT = 'DELETE FROM backoffice_audit WHERE at < ?';

export async function pruneBackoffice(input: { database: D1Database; now: number }): Promise<void> {
  const { database, now } = input;
  await database.batch([
    database.prepare(DELETE_EXPIRED_SESSIONS_STATEMENT).bind(now),
    database.prepare(DELETE_EXPIRED_PENDING_SIGN_INS_STATEMENT).bind(now),
    database.prepare(DELETE_OLD_AUDIT_STATEMENT).bind(now - BACKOFFICE_AUDIT_RETENTION_MS),
  ]);
}
