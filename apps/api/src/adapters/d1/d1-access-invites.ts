import { createInviteCode, INVITE_CODE_RANDOM_LENGTH, type AccessInvites } from '@zapbip/core';
import { AccountState, WAITLIST_INVITE_TTL_MS } from '@zapbip/types';
import { hashInviteCode } from '../platform/hash';

const ISSUE_STATEMENT = `INSERT INTO waitlist_invites (code_digest, email, created_at, expires_at)
  SELECT ?1, ?2, ?3, ?4
  WHERE NOT EXISTS (SELECT 1 FROM waitlist_invites WHERE email = ?2 AND (used_at IS NOT NULL OR expires_at > ?3))`;
const USE_INVITE_STATEMENT = `UPDATE waitlist_invites SET used_at = ?1, used_by_account_id = ?2
  WHERE code_digest = ?3 AND used_at IS NULL AND expires_at > ?1
  AND EXISTS (SELECT 1 FROM accounts WHERE id = ?2 AND state = ?4)`;
const OPEN_ACCOUNT_STATEMENT = `UPDATE accounts SET state = ?1, released_at = ?2
  WHERE id = ?3 AND state = ?4
  AND EXISTS (SELECT 1 FROM waitlist_invites WHERE code_digest = ?5 AND used_by_account_id = ?3 AND used_at = ?2)`;
const ONE_CHANGE = 1;

export class D1AccessInvites implements AccessInvites {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async issueMany(input: { emails: string[]; now: number }): Promise<(string | null)[]> {
    const { emails, now } = input;
    if (emails.length === 0) return [];
    const issued = await Promise.all(
      emails.map(async (email) => {
        const code = createInviteCode({ randomBytes: crypto.getRandomValues(new Uint8Array(INVITE_CODE_RANDOM_LENGTH)) });
        return { email, code, digest: await hashInviteCode({ code }) };
      }),
    );
    const results = await this.database.batch(
      issued.map((entry) => this.database.prepare(ISSUE_STATEMENT).bind(entry.digest, entry.email, now, now + WAITLIST_INVITE_TTL_MS)),
    );
    return issued.map((entry, index) => {
      const result = results[index];
      return result !== undefined && result.meta.changes === ONE_CHANGE ? entry.code : null;
    });
  }

  async redeem(input: { code: string; accountId: string; now: number }): Promise<boolean> {
    const { code, accountId, now } = input;
    const digest = await hashInviteCode({ code });
    const [useInvite, openAccount] = await this.database.batch([
      this.database.prepare(USE_INVITE_STATEMENT).bind(now, accountId, digest, AccountState.Waitlisted),
      this.database.prepare(OPEN_ACCOUNT_STATEMENT).bind(AccountState.Active, now, accountId, AccountState.Waitlisted, digest),
    ]);
    return useInvite?.meta.changes === ONE_CHANGE && openAccount?.meta.changes === ONE_CHANGE;
  }
}
