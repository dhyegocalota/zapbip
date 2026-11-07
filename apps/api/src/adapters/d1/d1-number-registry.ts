import type { Bindings } from '../../contract/env';
import type { NumberRegistry, OutboundNumber, RegisteredNumber } from '../../numbers/number-registry';
import { accessTokenAssociatedData, appSecretAssociatedData } from '../../numbers/number-sealing';
import { WorkerSecret } from '../../operations/worker-secret';
import { createAesGcmSecretBox, type SecretBox } from '../platform/aes-gcm-secret-box';

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
const FIND_FIRST_TWO_STATEMENT = 'SELECT ' + OUTBOUND_COLUMNS + ' FROM whatsapp_numbers ORDER BY created_at, id LIMIT 2';

function registeredOf(input: { row: RegisteredNumber }): RegisteredNumber {
  const { numberId, phoneNumberId, wabaId, state, metaAppRef } = input.row;
  return { numberId, phoneNumberId, wabaId, state, metaAppRef };
}

export class D1NumberRegistry implements NumberRegistry {
  private readonly database: D1Database;
  private readonly secretBox: SecretBox;

  constructor(input: { database: D1Database; secretBox: SecretBox }) {
    this.database = input.database;
    this.secretBox = input.secretBox;
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
  });
}
