import type { Clock, IdGenerator } from '@zapbip/core';
import { IdPrefix, WhatsAppNumberState } from '@zapbip/types';
import type { Bindings } from '../../contract/env';
import type {
  NumberRecord,
  NumberRegistry,
  OutboundNumber,
  RegisteredNumber,
  RegisterMetaAppInput,
  RegisterNumberInput,
  RegisteredNumberResult,
} from '../../numbers/number-registry';
import { conflictOf } from '../../numbers/registration-conflict';
import { assertNumberTransition } from '../../numbers/number-state';
import { accessTokenAssociatedData, appSecretAssociatedData } from '../../numbers/number-sealing';
import { WorkerSecret } from '../../operations/worker-secret';
import { createAesGcmSecretBox, type SecretBox } from '../platform/aes-gcm-secret-box';
import { createPlatformClock } from '../platform/clock';
import { createIdGenerator } from '../platform/ids';

type OutboundRow = RegisteredNumber & { sealedAccessToken: string };

const NUMBER_COLUMNS = 'id AS numberId, phone_number_id AS phoneNumberId, waba_id AS wabaId, state, meta_app_ref AS metaAppRef';
const OUTBOUND_COLUMNS = NUMBER_COLUMNS + ', sealed_access_token AS sealedAccessToken';
const FIND_BY_PHONE_NUMBER_IDS_STATEMENT =
  'SELECT ' + NUMBER_COLUMNS + ' FROM whatsapp_numbers WHERE phone_number_id IN (SELECT value FROM json_each(?))';
const FIND_BY_WABA_IDS_STATEMENT = 'SELECT ' + NUMBER_COLUMNS + ' FROM whatsapp_numbers WHERE waba_id IN (SELECT value FROM json_each(?))';
const FIND_APP_SECRET_STATEMENT = 'SELECT sealed_app_secret AS sealedAppSecret FROM meta_apps WHERE id = ?';
const FIND_FOR_ACCOUNT_STATEMENT =
  'SELECT ' + OUTBOUND_COLUMNS + ' FROM whatsapp_numbers WHERE id = (SELECT number_id FROM accounts WHERE id = ?)';
const FIND_FOR_INBOUND_STATEMENT = 'SELECT ' + OUTBOUND_COLUMNS + ' FROM whatsapp_numbers WHERE id = ?';
const INSERT_META_APP_STATEMENT =
  'INSERT INTO meta_apps (id, meta_app_id, label, sealed_app_secret, seal_key_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)';
const INSERT_NUMBER_STATEMENT = `INSERT INTO whatsapp_numbers
  (id, meta_app_ref, phone_number_id, waba_id, display_number, label, sealed_access_token, seal_key_version, state, credentials_changed_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const SEAL_KEY_VERSION = 1;
const BACKFILL_ACCOUNTS_STATEMENT =
  'UPDATE accounts SET number_id = ? WHERE number_id IS NULL AND (SELECT COUNT(*) FROM whatsapp_numbers) = 1';
const SINGLE_ROW_CHANGE = 1;
const RECORD_COLUMNS =
  NUMBER_COLUMNS +
  ', display_number AS displayNumber, label, verified_at AS verifiedAt, verification_snapshot AS verificationSnapshot, created_at AS createdAt, updated_at AS updatedAt';
const FIND_NUMBER_STATEMENT = 'SELECT ' + RECORD_COLUMNS + ' FROM whatsapp_numbers WHERE id = ?';
const TRANSITION_STATEMENT = 'UPDATE whatsapp_numbers SET state = ?, updated_at = ? WHERE id = ? AND state = ?';
const FIND_FIRST_TWO_STATEMENT = 'SELECT ' + OUTBOUND_COLUMNS + ' FROM whatsapp_numbers ORDER BY created_at, id LIMIT 2';
const FIND_START_DISPLAY_NUMBER_STATEMENT =
  'SELECT display_number AS displayNumber FROM whatsapp_numbers WHERE state = ? ORDER BY created_at, id LIMIT 1';

function registrationFailureOf(input: { error: unknown }): unknown {
  const conflict = conflictOf({ error: input.error });
  return conflict === null ? input.error : conflict;
}

function registeredOf(input: { row: RegisteredNumber }): RegisteredNumber {
  const { numberId, phoneNumberId, wabaId, state, metaAppRef } = input.row;
  return { numberId, phoneNumberId, wabaId, state, metaAppRef };
}

export class D1NumberRegistry implements NumberRegistry {
  private readonly database: D1Database;
  private readonly secretBox: SecretBox;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  constructor(input: { database: D1Database; secretBox: SecretBox; ids: IdGenerator; clock: Clock }) {
    this.database = input.database;
    this.secretBox = input.secretBox;
    this.ids = input.ids;
    this.clock = input.clock;
  }

  async registerMetaApp(input: RegisterMetaAppInput): Promise<{ metaAppRef: string }> {
    const metaAppRef = this.ids.next({ prefix: IdPrefix.MetaApp });
    const sealedAppSecret = await this.secretBox.seal({ plain: input.appSecret, associatedData: appSecretAssociatedData({ metaAppRef }) });
    const now = this.clock.now();
    await this.database
      .prepare(INSERT_META_APP_STATEMENT)
      .bind(metaAppRef, input.metaAppId, input.label, sealedAppSecret, SEAL_KEY_VERSION, now, now)
      .run();
    return { metaAppRef };
  }

  async registerNumber(input: RegisterNumberInput): Promise<RegisteredNumberResult> {
    const numberId = this.ids.next({ prefix: IdPrefix.Number });
    const statements = await this.numberStatements({ numberId, number: input });
    const backfilledAccounts = await this.runRegistration({ statements });
    return { numberId, backfilledAccounts };
  }

  async registerNumberWithNewMetaApp(input: {
    metaApp: RegisterMetaAppInput;
    number: Omit<RegisterNumberInput, 'metaAppRef'>;
  }): Promise<RegisteredNumberResult & { metaAppRef: string }> {
    const metaAppRef = this.ids.next({ prefix: IdPrefix.MetaApp });
    const numberId = this.ids.next({ prefix: IdPrefix.Number });
    const sealedAppSecret = await this.secretBox.seal({
      plain: input.metaApp.appSecret,
      associatedData: appSecretAssociatedData({ metaAppRef }),
    });
    const now = this.clock.now();
    const metaAppStatement = this.database
      .prepare(INSERT_META_APP_STATEMENT)
      .bind(metaAppRef, input.metaApp.metaAppId, input.metaApp.label, sealedAppSecret, SEAL_KEY_VERSION, now, now);
    const numberStatements = await this.numberStatements({ numberId, number: { ...input.number, metaAppRef } });
    const backfilledAccounts = await this.runRegistration({ statements: [metaAppStatement, ...numberStatements] });
    return { metaAppRef, numberId, backfilledAccounts };
  }

  private async numberStatements(input: { numberId: string; number: RegisterNumberInput }): Promise<D1PreparedStatement[]> {
    const { numberId, number } = input;
    const sealedAccessToken = await this.secretBox.seal({
      plain: number.accessToken,
      associatedData: accessTokenAssociatedData({ numberId }),
    });
    const now = this.clock.now();
    return [
      this.database
        .prepare(INSERT_NUMBER_STATEMENT)
        .bind(
          numberId,
          number.metaAppRef,
          number.phoneNumberId,
          number.wabaId,
          number.displayNumber,
          number.label,
          sealedAccessToken,
          SEAL_KEY_VERSION,
          WhatsAppNumberState.Pending,
          now,
          now,
          now,
        ),
      this.database.prepare(BACKFILL_ACCOUNTS_STATEMENT).bind(numberId),
    ];
  }

  private async runRegistration(input: { statements: D1PreparedStatement[] }): Promise<number> {
    const results = await this.database.batch(input.statements).catch((error: unknown) => {
      throw registrationFailureOf({ error });
    });
    const backfill = results[results.length - 1];
    if (backfill === undefined) throw new Error('the registration batch returned no result');
    return backfill.meta.changes;
  }

  findNumber(input: { numberId: string }): Promise<NumberRecord | null> {
    return this.database.prepare(FIND_NUMBER_STATEMENT).bind(input.numberId).first<NumberRecord>();
  }

  async transition(input: { numberId: string; to: WhatsAppNumberState }): Promise<void> {
    const number = await this.findNumber({ numberId: input.numberId });
    if (number === null) throw new Error(`number ${input.numberId} is not registered`);
    assertNumberTransition({ from: number.state, to: input.to, verifiedAt: number.verifiedAt });
    const result = await this.database.prepare(TRANSITION_STATEMENT).bind(input.to, this.clock.now(), input.numberId, number.state).run();
    if (result.meta.changes !== SINGLE_ROW_CHANGE) throw new Error(`number ${input.numberId} changed state during the transition`);
  }

  async findByPhoneNumberIds(input: { phoneNumberIds: string[] }): Promise<RegisteredNumber[]> {
    const { results } = await this.database
      .prepare(FIND_BY_PHONE_NUMBER_IDS_STATEMENT)
      .bind(JSON.stringify(input.phoneNumberIds))
      .all<RegisteredNumber>();
    return results.map((row) => registeredOf({ row }));
  }

  async findByWabaIds(input: { wabaIds: string[] }): Promise<RegisteredNumber[]> {
    const { results } = await this.database.prepare(FIND_BY_WABA_IDS_STATEMENT).bind(JSON.stringify(input.wabaIds)).all<RegisteredNumber>();
    return results.map((row) => registeredOf({ row }));
  }

  async openAppSecret(input: { metaAppRef: string }): Promise<string> {
    const row = await this.database.prepare(FIND_APP_SECRET_STATEMENT).bind(input.metaAppRef).first<{ sealedAppSecret: string }>();
    if (row === null) throw new Error(`meta app ${input.metaAppRef} is not registered`);
    const plain = await this.secretBox.open({
      sealed: row.sealedAppSecret,
      associatedData: appSecretAssociatedData({ metaAppRef: input.metaAppRef }),
    });
    if (plain === null) throw new Error(`the app secret of meta app ${input.metaAppRef} does not open`);
    return plain;
  }

  async openForAccount(input: { accountId: string }): Promise<OutboundNumber> {
    const row = await this.database.prepare(FIND_FOR_ACCOUNT_STATEMENT).bind(input.accountId).first<OutboundRow>();
    if (row === null) throw new Error('account has no number');
    return this.openOutbound({ row });
  }

  async openForInbound(input: { numberId: string }): Promise<OutboundNumber> {
    const row = await this.database.prepare(FIND_FOR_INBOUND_STATEMENT).bind(input.numberId).first<OutboundRow>();
    if (row === null) throw new Error(`number ${input.numberId} is not registered`);
    return this.openOutbound({ row });
  }

  async openTheOnlyNumber(): Promise<OutboundNumber> {
    const { results } = await this.database.prepare(FIND_FIRST_TWO_STATEMENT).all<OutboundRow>();
    const [row, other] = results;
    if (row === undefined) throw new Error('no WhatsApp number is registered');
    if (other !== undefined) throw new Error('more than one WhatsApp number is registered');
    return this.openOutbound({ row });
  }

  async findStartDisplayNumber(): Promise<string | null> {
    const row = await this.database
      .prepare(FIND_START_DISPLAY_NUMBER_STATEMENT)
      .bind(WhatsAppNumberState.Active)
      .first<{ displayNumber: string }>();
    if (row === null) return null;
    return row.displayNumber;
  }

  private async openOutbound(input: { row: OutboundRow }): Promise<OutboundNumber> {
    const { row } = input;
    const accessToken = await this.secretBox.open({
      sealed: row.sealedAccessToken,
      associatedData: accessTokenAssociatedData({ numberId: row.numberId }),
    });
    if (accessToken === null) throw new Error(`the access token of number ${row.numberId} does not open`);
    return { ...registeredOf({ row }), accessToken };
  }
}

export function numberRegistryOf(input: { bindings: Pick<Bindings, 'CONNECTIONS' | 'NUMBER_REGISTRY_KEY'> }): NumberRegistry {
  return new D1NumberRegistry({
    database: input.bindings.CONNECTIONS,
    secretBox: createAesGcmSecretBox({ base64Key: input.bindings.NUMBER_REGISTRY_KEY, keyName: WorkerSecret.NumberRegistryKey }),
    ids: createIdGenerator(),
    clock: createPlatformClock(),
  });
}
