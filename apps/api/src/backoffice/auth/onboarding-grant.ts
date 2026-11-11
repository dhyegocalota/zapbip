import { ONBOARDING_GRANT_TTL_MS } from '../backoffice-constants';

const SINGLE_ROW_CHANGE = 1;
const GRANT_STATEMENT = 'UPDATE backoffice_sessions SET onboarding_grant_until = ? WHERE token_digest = ?';
const CONSUME_STATEMENT =
  'UPDATE backoffice_sessions SET onboarding_grant_until = NULL WHERE token_digest = ? AND onboarding_grant_until > ?';
const FIND_STATEMENT = 'SELECT onboarding_grant_until AS grantUntil FROM backoffice_sessions WHERE token_digest = ?';

export async function grantOnboarding(input: { database: D1Database; digest: string; now: number }): Promise<void> {
  await input.database
    .prepare(GRANT_STATEMENT)
    .bind(input.now + ONBOARDING_GRANT_TTL_MS, input.digest)
    .run();
}

export async function hasLiveGrant(input: { database: D1Database; digest: string; now: number }): Promise<boolean> {
  const row = await input.database.prepare(FIND_STATEMENT).bind(input.digest).first<{ grantUntil: number | null }>();
  return row !== null && row.grantUntil !== null && row.grantUntil > input.now;
}

export async function consumeGrant(input: { database: D1Database; digest: string; now: number }): Promise<boolean> {
  const result = await input.database.prepare(CONSUME_STATEMENT).bind(input.digest, input.now).run();
  return result.meta.changes === SINGLE_ROW_CHANGE;
}
