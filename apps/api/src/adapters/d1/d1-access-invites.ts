import { createInviteCode, INVITE_CODE_RANDOM_LENGTH, type AccessInvites } from '@zapbip/core';
import { WAITLIST_INVITE_TTL_MS } from '@zapbip/types';
import { hashInviteCode } from '../platform/hash';

const ISSUE_STATEMENT = `INSERT INTO waitlist_invites (code_digest, email, created_at, expires_at)
  SELECT ?1, ?2, ?3, ?4
  WHERE NOT EXISTS (SELECT 1 FROM waitlist_invites WHERE email = ?2 AND (used_at IS NOT NULL OR expires_at > ?3))`;
const CONSUME_STATEMENT = 'UPDATE waitlist_invites SET used_at = ?1 WHERE code_digest = ?2 AND used_at IS NULL AND expires_at > ?1';
const ISSUED_CHANGES = 1;

export class D1AccessInvites implements AccessInvites {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async issue(input: { email: string; now: number }): Promise<string | null> {
    const code = createInviteCode({ randomBytes: crypto.getRandomValues(new Uint8Array(INVITE_CODE_RANDOM_LENGTH)) });
    const codeDigest = await hashInviteCode({ code });
    const result = await this.database
      .prepare(ISSUE_STATEMENT)
      .bind(codeDigest, input.email, input.now, input.now + WAITLIST_INVITE_TTL_MS)
      .run();
    return result.meta.changes === ISSUED_CHANGES ? code : null;
  }

  async consume(input: { code: string; now: number }): Promise<boolean> {
    const result = await this.database
      .prepare(CONSUME_STATEMENT)
      .bind(input.now, await hashInviteCode({ code: input.code }))
      .run();
    return result.meta.changes === ISSUED_CHANGES;
  }
}
