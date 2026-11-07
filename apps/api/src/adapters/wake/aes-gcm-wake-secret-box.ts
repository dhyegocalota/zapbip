import type { WakeSecretBox } from '@zapbip/core';
import { createAesGcmSecretBox } from '../platform/aes-gcm-secret-box';

const KEY_NAME = 'WAKE_SECRET_KEY';

export function createAesGcmWakeSecretBox(input: { base64Key: string }): WakeSecretBox {
  return createAesGcmSecretBox({ base64Key: input.base64Key, keyName: KEY_NAME });
}
