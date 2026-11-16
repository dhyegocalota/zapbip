import { WhatsAppNumberState } from '@zapbip/types';
import { createAesGcmSecretBox } from '../../src/adapters/platform/aes-gcm-secret-box';
import type { RegisteredNumber } from '../../src/numbers/number-registry';
import { accessTokenAssociatedData, twoStepPinAssociatedData } from '../../src/numbers/number-sealing';
import { WorkerSecret } from '../../src/operations/worker-secret';
import { applyDirectoryMigration, SEED_CREATED_AT } from './seed';
import { testEnv } from './workers-env';

export const TEST_NUMBER_ID = 'num_test';
export const TEST_PHONE_NUMBER_ID = '1000000000000001';
export const TEST_WABA_ID = '3000000000000003';
export const TEST_ACCESS_TOKEN = 'test-access-token';

export const TEST_REGISTERED_NUMBER: RegisteredNumber = {
  numberId: TEST_NUMBER_ID,
  phoneNumberId: TEST_PHONE_NUMBER_ID,
  wabaId: TEST_WABA_ID,
  state: WhatsAppNumberState.Active,
};

export const TEST_DISPLAY_NUMBER = '5511977770000';
const SEAL_KEY_VERSION = 1;

export type SeededWhatsAppNumber = {
  numberId: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
};

export type WhatsAppNumberSeed = Partial<SeededWhatsAppNumber> & {
  state?: WhatsAppNumberState;
  displayNumber?: string;
  twoStepPin?: string | null;
};

export function testSecretBox() {
  return createAesGcmSecretBox({ base64Key: testEnv.NUMBER_REGISTRY_KEY, keyName: WorkerSecret.NumberRegistryKey });
}

export async function seedWhatsAppNumber(input: WhatsAppNumberSeed = {}): Promise<SeededWhatsAppNumber> {
  const {
    numberId = TEST_NUMBER_ID,
    phoneNumberId = TEST_PHONE_NUMBER_ID,
    wabaId = TEST_WABA_ID,
    accessToken = TEST_ACCESS_TOKEN,
    state = WhatsAppNumberState.Active,
    displayNumber = TEST_DISPLAY_NUMBER,
    twoStepPin = null,
  } = input;
  const secretBox = testSecretBox();
  const sealedAccessToken = await secretBox.seal({ plain: accessToken, associatedData: accessTokenAssociatedData({ numberId }) });
  const sealedTwoStepPin =
    twoStepPin === null ? null : await secretBox.seal({ plain: twoStepPin, associatedData: twoStepPinAssociatedData({ numberId }) });
  await testEnv.CONNECTIONS.batch([
    testEnv.CONNECTIONS.prepare(
      `INSERT INTO whatsapp_numbers (id, phone_number_id, waba_id, display_number, label, sealed_access_token, sealed_two_step_pin, seal_key_version, state, verified_at, credentials_changed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      numberId,
      phoneNumberId,
      wabaId,
      displayNumber,
      numberId,
      sealedAccessToken,
      sealedTwoStepPin,
      SEAL_KEY_VERSION,
      state,
      SEED_CREATED_AT,
      SEED_CREATED_AT,
      SEED_CREATED_AT,
      SEED_CREATED_AT,
    ),
  ]);
  return { numberId, phoneNumberId, wabaId, accessToken };
}

export async function applyDirectoryMigrationWithNumber(): Promise<void> {
  await applyDirectoryMigration();
  await seedWhatsAppNumber();
}
