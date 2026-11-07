import { WAKE_IV_BYTES, WAKE_SEALED_KEY_VERSION, WAKE_SECRET_KEY_BYTES, type WakeSecretBox } from '@zapbip/core';

const ALGORITHM = 'AES-GCM';
const BASE64 = 'base64';
const KEY_NAME = 'WAKE_SECRET_KEY';
const VERSION_BYTES = 1;

function decodeKey(input: { base64Key: string }): Buffer {
  const isText = typeof input.base64Key === 'string';
  const bytes = isText ? Buffer.from(input.base64Key, BASE64) : null;
  if (bytes === null || bytes.length !== WAKE_SECRET_KEY_BYTES) {
    throw new Error(`${KEY_NAME} must be ${WAKE_SECRET_KEY_BYTES} bytes encoded in base64`);
  }
  return bytes;
}

function encode(input: { text: string }): Uint8Array {
  return new TextEncoder().encode(input.text);
}

export function createAesGcmWakeSecretBox(input: { base64Key: string }): WakeSecretBox {
  let keyPromise: Promise<CryptoKey> | null = null;

  function loadKey(): Promise<CryptoKey> {
    if (keyPromise === null) keyPromise = crypto.subtle.importKey('raw', decodeKey(input), ALGORITHM, false, ['encrypt', 'decrypt']);
    return keyPromise;
  }

  return {
    seal: async ({ plain, associatedData }) => {
      const key = await loadKey();
      const iv = crypto.getRandomValues(new Uint8Array(WAKE_IV_BYTES));
      const cipher = await crypto.subtle.encrypt(
        { name: ALGORITHM, iv, additionalData: encode({ text: associatedData }) },
        key,
        encode({ text: plain }),
      );
      return Buffer.concat([Uint8Array.of(WAKE_SEALED_KEY_VERSION), iv, new Uint8Array(cipher)]).toString(BASE64);
    },
    open: async ({ sealed, associatedData }) => {
      const key = await loadKey();
      const bytes = Buffer.from(sealed, BASE64);
      if (bytes[0] !== WAKE_SEALED_KEY_VERSION) return null;
      const iv = bytes.subarray(VERSION_BYTES, VERSION_BYTES + WAKE_IV_BYTES);
      const cipher = bytes.subarray(VERSION_BYTES + WAKE_IV_BYTES);
      try {
        const plain = await crypto.subtle.decrypt({ name: ALGORITHM, iv, additionalData: encode({ text: associatedData }) }, key, cipher);
        return new TextDecoder().decode(plain);
      } catch {
        return null;
      }
    },
  };
}
