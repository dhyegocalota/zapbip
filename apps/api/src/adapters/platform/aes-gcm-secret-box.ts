import type { WakeSecretBox } from '@zapbip/core';

export type SecretBox = WakeSecretBox;

export function createAesGcmSecretBox(_input: { base64Key: string; keyName: string }): SecretBox {
  throw new Error('createAesGcmSecretBox is not implemented');
}
