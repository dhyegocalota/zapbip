import { RESTRICTION_TTL_MS } from '../whatsapp/whatsapp-constants';

const FIND_ACTIVE_STATEMENT = 'SELECT error_code AS errorCode FROM channel_restrictions WHERE phone_number_id = ? AND restricted_at > ?';
const RECORD_STATEMENT = `INSERT INTO channel_restrictions (phone_number_id, error_code, restricted_at) VALUES (?, ?, ?)
  ON CONFLICT (phone_number_id) DO UPDATE SET error_code = excluded.error_code, restricted_at = excluded.restricted_at`;

export type ChannelRestrictions = {
  findActive(input: { now: number }): Promise<{ errorCode: number } | null>;
  record(input: { errorCode: number; restrictedAt: number }): Promise<void>;
};

export class D1ChannelRestrictions implements ChannelRestrictions {
  private readonly database: D1Database;
  private readonly phoneNumberId: string;

  constructor(input: { database: D1Database; phoneNumberId: string }) {
    this.database = input.database;
    this.phoneNumberId = input.phoneNumberId;
  }

  findActive(input: { now: number }): Promise<{ errorCode: number } | null> {
    return this.database
      .prepare(FIND_ACTIVE_STATEMENT)
      .bind(this.phoneNumberId, input.now - RESTRICTION_TTL_MS)
      .first<{ errorCode: number }>();
  }

  async record(input: { errorCode: number; restrictedAt: number }): Promise<void> {
    await this.database.prepare(RECORD_STATEMENT).bind(this.phoneNumberId, input.errorCode, input.restrictedAt).run();
  }
}
