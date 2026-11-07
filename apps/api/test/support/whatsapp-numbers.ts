import { WhatsAppNumberState } from '@zapbip/types';
import { createAesGcmSecretBox } from '../../src/adapters/platform/aes-gcm-secret-box';
import type { RegisteredNumber } from '../../src/numbers/number-registry';
import { accessTokenAssociatedData, appSecretAssociatedData } from '../../src/numbers/number-sealing';
import { WorkerSecret } from '../../src/operations/worker-secret';
import { applyDirectoryMigration, SEED_CREATED_AT } from './seed';
import { testEnv } from './workers-env';

export const TEST_NUMBER_ID = 'num_test';
export const TEST_META_APP_REF = 'mapp_test';
export const TEST_PHONE_NUMBER_ID = '1000000000000001';
export const TEST_WABA_ID = '3000000000000003';
export const TEST_ACCESS_TOKEN = 'test-access-token';
export const TEST_APP_SECRET = 'test-app-secret';

export const TEST_REGISTERED_NUMBER: RegisteredNumber = {
  numberId: TEST_NUMBER_ID,
  phoneNumberId: TEST_PHONE_NUMBER_ID,
  wabaId: TEST_WABA_ID,
  state: WhatsAppNumberState.Active,
  metaAppRef: TEST_META_APP_REF,
};

export const TEST_DISPLAY_NUMBER = '5511977770000';
const SEAL_KEY_VERSION = 1;

export type SeededWhatsAppNumber = {
  numberId: string;
  metaAppRef: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  appSecret: string;
};

export type WhatsAppNumberSeed = Partial<SeededWhatsAppNumber> & { state?: WhatsAppNumberState; displayNumber?: string };

export function testSecretBox() {
  return createAesGcmSecretBox({ base64Key: testEnv.NUMBER_REGISTRY_KEY, keyName: WorkerSecret.NumberRegistryKey });
}

export async function seedWhatsAppNumber(input: WhatsAppNumberSeed = {}): Promise<SeededWhatsAppNumber> {
  const {
    numberId = TEST_NUMBER_ID,
    metaAppRef = TEST_META_APP_REF,
    phoneNumberId = TEST_PHONE_NUMBER_ID,
    wabaId = TEST_WABA_ID,
    accessToken = TEST_ACCESS_TOKEN,
    appSecret = TEST_APP_SECRET,
    state = WhatsAppNumberState.Active,
    displayNumber = TEST_DISPLAY_NUMBER,
  } = input;
  const secretBox = testSecretBox();
  const sealedAppSecret = await secretBox.seal({ plain: appSecret, associatedData: appSecretAssociatedData({ metaAppRef }) });
  const sealedAccessToken = await secretBox.seal({ plain: accessToken, associatedData: accessTokenAssociatedData({ numberId }) });
  await testEnv.CONNECTIONS.batch([
    testEnv.CONNECTIONS.prepare(
      'INSERT INTO meta_apps (id, meta_app_id, label, sealed_app_secret, seal_key_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING',
    ).bind(metaAppRef, `app-${metaAppRef}`, metaAppRef, sealedAppSecret, SEAL_KEY_VERSION, SEED_CREATED_AT, SEED_CREATED_AT),
    testEnv.CONNECTIONS.prepare(
      `INSERT INTO whatsapp_numbers (id, meta_app_ref, phone_number_id, waba_id, display_number, label, sealed_access_token, seal_key_version, state, verified_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      numberId,
      metaAppRef,
      phoneNumberId,
      wabaId,
      displayNumber,
      numberId,
      sealedAccessToken,
      SEAL_KEY_VERSION,
      state,
      SEED_CREATED_AT,
      SEED_CREATED_AT,
      SEED_CREATED_AT,
    ),
  ]);
  return { numberId, metaAppRef, phoneNumberId, wabaId, accessToken, appSecret };
}

export async function applyDirectoryMigrationWithNumber(): Promise<void> {
  await applyDirectoryMigration();
  await seedWhatsAppNumber();
}
