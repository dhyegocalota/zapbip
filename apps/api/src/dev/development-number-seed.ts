import { WhatsAppNumberState } from '@zapbip/types';
import { createAesGcmSecretBox } from '../adapters/platform/aes-gcm-secret-box';
import type { Bindings } from '../contract/env';
import { accessTokenAssociatedData, appSecretAssociatedData } from '../numbers/number-sealing';
import { WorkerSecret } from '../operations/worker-secret';
import { DEVELOPMENT_NUMBER } from './development-number';

const SEAL_KEY_VERSION = 1;
const INSERT_META_APP_STATEMENT =
  'INSERT INTO meta_apps (id, meta_app_id, label, sealed_app_secret, seal_key_version, created_at, updated_at) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?6 WHERE NOT EXISTS (SELECT 1 FROM whatsapp_numbers)';
const INSERT_NUMBER_STATEMENT =
  'INSERT INTO whatsapp_numbers (id, meta_app_ref, phone_number_id, waba_id, display_number, label, sealed_access_token, seal_key_version, state, verified_at, credentials_changed_at, created_at, updated_at) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?10, ?10 WHERE NOT EXISTS (SELECT 1 FROM whatsapp_numbers)';

export async function developmentNumberStatements(input: {
  bindings: Pick<Bindings, 'CONNECTIONS' | 'NUMBER_REGISTRY_KEY'>;
  createdAt: number;
}): Promise<D1PreparedStatement[]> {
  const { bindings, createdAt } = input;
  const { numberId, metaAppRef, metaAppId, phoneNumberId, wabaId, displayNumber, label, accessToken, appSecret } = DEVELOPMENT_NUMBER;
  const secretBox = createAesGcmSecretBox({ base64Key: bindings.NUMBER_REGISTRY_KEY, keyName: WorkerSecret.NumberRegistryKey });
  const sealedAppSecret = await secretBox.seal({ plain: appSecret, associatedData: appSecretAssociatedData({ metaAppRef }) });
  const sealedAccessToken = await secretBox.seal({ plain: accessToken, associatedData: accessTokenAssociatedData({ numberId }) });
  return [
    bindings.CONNECTIONS.prepare(INSERT_META_APP_STATEMENT).bind(
      metaAppRef,
      metaAppId,
      label,
      sealedAppSecret,
      SEAL_KEY_VERSION,
      createdAt,
    ),
    bindings.CONNECTIONS.prepare(INSERT_NUMBER_STATEMENT).bind(
      numberId,
      metaAppRef,
      phoneNumberId,
      wabaId,
      displayNumber,
      label,
      sealedAccessToken,
      SEAL_KEY_VERSION,
      WhatsAppNumberState.Active,
      createdAt,
    ),
  ];
}
