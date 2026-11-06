import type { WakeSecretBox } from '@zapbip/core';

export function createAesGcmWakeSecretBox(input: { base64Key: string }): WakeSecretBox {
  void input;
  throw new Error('createAesGcmWakeSecretBox is not implemented');
}
