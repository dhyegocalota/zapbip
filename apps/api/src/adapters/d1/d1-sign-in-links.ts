import type { SignInLinks } from '@zapbip/core';
import { CLIENT_APP_TOKEN_BYTES } from '@zapbip/types';
import { encodeBase64Url } from '../platform/encoding';
import { sha256Hex } from '../platform/hash';

const UPSERT_TOKEN_STATEMENT = `INSERT INTO client_app_sign_in_tokens (token_digest, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)
  ON CONFLICT (account_id) DO UPDATE SET token_digest = excluded.token_digest, created_at = excluded.created_at, expires_at = excluded.expires_at`;

export class D1SignInLinks implements SignInLinks {
  private readonly database: D1Database;

  constructor(input: { database: D1Database }) {
    this.database = input.database;
  }

  async issue(input: { accountId: string; issuedAt: number; expiresAt: number }): Promise<string> {
    const token = encodeBase64Url({ bytes: crypto.getRandomValues(new Uint8Array(CLIENT_APP_TOKEN_BYTES)) });
    const tokenDigest = await sha256Hex({ value: token });
    await this.database.prepare(UPSERT_TOKEN_STATEMENT).bind(tokenDigest, input.accountId, input.issuedAt, input.expiresAt).run();
    return token;
  }
}
