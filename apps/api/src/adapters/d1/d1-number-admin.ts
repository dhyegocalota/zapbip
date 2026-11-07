import type { Clock } from '@zapbip/core';
import { WhatsAppNumberState } from '@zapbip/types';
import type { Bindings } from '../../contract/env';
import type { MetaAppRecord, NumberAdmin, NumberListEntry } from '../../numbers/number-admin';
import { accessTokenAssociatedData, appSecretAssociatedData } from '../../numbers/number-sealing';
import { WorkerSecret } from '../../operations/worker-secret';
import { createAesGcmSecretBox, type SecretBox } from '../platform/aes-gcm-secret-box';
import { createPlatformClock } from '../platform/clock';

const SINGLE_ROW_CHANGE = 1;
const LIST_NUMBERS_STATEMENT = `SELECT n.id AS numberId, n.phone_number_id AS phoneNumberId, n.waba_id AS wabaId, n.state AS state,
  n.meta_app_ref AS metaAppRef, n.display_number AS displayNumber, n.label AS label, n.verified_at AS verifiedAt,
  n.verification_snapshot AS verificationSnapshot, n.created_at AS createdAt, n.updated_at AS updatedAt,
  a.label AS metaAppLabel, a.updated_at AS metaAppUpdatedAt, (SELECT COUNT(*) FROM accounts WHERE accounts.number_id = n.id) AS accountCount
  FROM whatsapp_numbers n JOIN meta_apps a ON a.id = n.meta_app_ref
  ORDER BY CASE n.state WHEN ? THEN 0 WHEN ? THEN 1 WHEN ? THEN 2 ELSE 3 END, n.label`;
const LIST_META_APPS_STATEMENT =
  'SELECT id AS metaAppRef, meta_app_id AS metaAppId, label, updated_at AS updatedAt FROM meta_apps ORDER BY label';
const RECORD_VERIFICATION_STATEMENT =
  'UPDATE whatsapp_numbers SET verification_snapshot = ?, verified_at = COALESCE(?, verified_at), updated_at = ? WHERE id = ?';
const REPLACE_ACCESS_TOKEN_STATEMENT = 'UPDATE whatsapp_numbers SET sealed_access_token = ?, updated_at = ? WHERE id = ?';
const REPLACE_APP_SECRET_STATEMENT = 'UPDATE meta_apps SET sealed_app_secret = ?, updated_at = ? WHERE id = ?';

export class D1NumberAdmin implements NumberAdmin {
  private readonly database: D1Database;
  private readonly secretBox: SecretBox;
  private readonly clock: Clock;

  constructor(input: { database: D1Database; secretBox: SecretBox; clock: Clock }) {
    this.database = input.database;
    this.secretBox = input.secretBox;
    this.clock = input.clock;
  }

  async listNumbers(): Promise<NumberListEntry[]> {
    const { results } = await this.database
      .prepare(LIST_NUMBERS_STATEMENT)
      .bind(WhatsAppNumberState.Active, WhatsAppNumberState.Closed, WhatsAppNumberState.Pending)
      .all<NumberListEntry>();
    return results;
  }

  async listMetaApps(): Promise<MetaAppRecord[]> {
    const { results } = await this.database.prepare(LIST_META_APPS_STATEMENT).all<MetaAppRecord>();
    return results;
  }

  async recordVerification(input: { numberId: string; snapshot: string; verifiedAt: number | null }): Promise<void> {
    const result = await this.database
      .prepare(RECORD_VERIFICATION_STATEMENT)
      .bind(input.snapshot, input.verifiedAt, this.clock.now(), input.numberId)
      .run();
    this.assertUpdated({ changes: result.meta.changes, subject: `number ${input.numberId}` });
  }

  async replaceAccessToken(input: { numberId: string; accessToken: string }): Promise<void> {
    const sealed = await this.secretBox.seal({
      plain: input.accessToken,
      associatedData: accessTokenAssociatedData({ numberId: input.numberId }),
    });
    const result = await this.database.prepare(REPLACE_ACCESS_TOKEN_STATEMENT).bind(sealed, this.clock.now(), input.numberId).run();
    this.assertUpdated({ changes: result.meta.changes, subject: `number ${input.numberId}` });
  }

  async replaceAppSecret(input: { metaAppRef: string; appSecret: string }): Promise<void> {
    const sealed = await this.secretBox.seal({
      plain: input.appSecret,
      associatedData: appSecretAssociatedData({ metaAppRef: input.metaAppRef }),
    });
    const result = await this.database.prepare(REPLACE_APP_SECRET_STATEMENT).bind(sealed, this.clock.now(), input.metaAppRef).run();
    this.assertUpdated({ changes: result.meta.changes, subject: `meta app ${input.metaAppRef}` });
  }

  private assertUpdated(input: { changes: number; subject: string }): void {
    if (input.changes !== SINGLE_ROW_CHANGE) throw new Error(`${input.subject} is not registered`);
  }
}

export function numberAdminOf(input: { bindings: Pick<Bindings, 'CONNECTIONS' | 'NUMBER_REGISTRY_KEY'> }): NumberAdmin {
  return new D1NumberAdmin({
    database: input.bindings.CONNECTIONS,
    secretBox: createAesGcmSecretBox({ base64Key: input.bindings.NUMBER_REGISTRY_KEY, keyName: WorkerSecret.NumberRegistryKey }),
    clock: createPlatformClock(),
  });
}
