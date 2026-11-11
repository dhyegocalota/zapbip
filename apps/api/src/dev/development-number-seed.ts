import { WhatsAppNumberState } from '@zapbip/types';
import { createAesGcmSecretBox } from '../adapters/platform/aes-gcm-secret-box';
import type { Bindings } from '../contract/env';
import { accessTokenAssociatedData } from '../numbers/number-sealing';
import { WorkerSecret } from '../operations/worker-secret';
import { DEVELOPMENT_NUMBER } from './development-number';

const SEAL_KEY_VERSION = 1;
const INSERT_NUMBER_STATEMENT =
  'INSERT INTO whatsapp_numbers (id, phone_number_id, waba_id, display_number, label, sealed_access_token, seal_key_version, state, verified_at, credentials_changed_at, created_at, updated_at) SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9, ?9, ?9 WHERE NOT EXISTS (SELECT 1 FROM whatsapp_numbers)';

const PREFIX_DISPLAY_NUMBER_STATEMENT =
  "UPDATE whatsapp_numbers SET display_number = '+' || display_number WHERE id = ?1 AND display_number NOT LIKE '+%'";

export async function developmentNumberStatements(input: {
  bindings: Pick<Bindings, 'CONNECTIONS' | 'NUMBER_REGISTRY_KEY'>;
  createdAt: number;
}): Promise<D1PreparedStatement[]> {
  const { bindings, createdAt } = input;
  const { numberId, phoneNumberId, wabaId, displayNumber, label, accessToken } = DEVELOPMENT_NUMBER;
  const secretBox = createAesGcmSecretBox({ base64Key: bindings.NUMBER_REGISTRY_KEY, keyName: WorkerSecret.NumberRegistryKey });
  const sealedAccessToken = await secretBox.seal({ plain: accessToken, associatedData: accessTokenAssociatedData({ numberId }) });
  return [
    bindings.CONNECTIONS.prepare(INSERT_NUMBER_STATEMENT).bind(
      numberId,
      phoneNumberId,
      wabaId,
      displayNumber,
      label,
      sealedAccessToken,
      SEAL_KEY_VERSION,
      WhatsAppNumberState.Active,
      createdAt,
    ),
    bindings.CONNECTIONS.prepare(PREFIX_DISPLAY_NUMBER_STATEMENT).bind(numberId),
  ];
}
