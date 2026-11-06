import type { InstallCodeVault, IssuedInstallCode } from '@zapbip/core';
import { INSTALL_CODE_PREFIX, INSTALL_CODE_RANDOM_BYTES } from '@zapbip/types';
import { INSTALL_CODE_KEY_INFO, SEAL_INITIALIZATION_VECTOR_BYTES } from '../../contract/constants';
import { decodeBase64Url, encodeBase64Url } from './encoding';
import { hashInstallCode } from './hash';

const KEY_DERIVATION = 'HKDF';
const KEY_DERIVATION_HASH = 'SHA-256';
const SEAL_CIPHER = 'AES-GCM';
const SEAL_KEY_BITS = 256;

async function deriveSealKey(input: { installCode: string }): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', encoder.encode(input.installCode), KEY_DERIVATION, false, ['deriveKey']);
  const derivation = {
    name: KEY_DERIVATION,
    hash: KEY_DERIVATION_HASH,
    salt: new Uint8Array(),
    info: encoder.encode(INSTALL_CODE_KEY_INFO),
  };
  return crypto.subtle.deriveKey(derivation, material, { name: SEAL_CIPHER, length: SEAL_KEY_BITS }, false, ['encrypt', 'decrypt']);
}

export function createInstallCodeVault(): InstallCodeVault {
  return {
    async issue(): Promise<IssuedInstallCode> {
      const bytes = crypto.getRandomValues(new Uint8Array(INSTALL_CODE_RANDOM_BYTES));
      const installCode = `${INSTALL_CODE_PREFIX}${encodeBase64Url({ bytes })}`;
      return { installCode, digest: await hashInstallCode({ installCode }) };
    },
    async seal({ installCode, secret }): Promise<string> {
      const key = await deriveSealKey({ installCode });
      const initializationVector = crypto.getRandomValues(new Uint8Array(SEAL_INITIALIZATION_VECTOR_BYTES));
      const cipherText = await crypto.subtle.encrypt(
        { name: SEAL_CIPHER, iv: initializationVector },
        key,
        new TextEncoder().encode(secret),
      );
      return encodeBase64Url({ bytes: new Uint8Array([...initializationVector, ...new Uint8Array(cipherText)]) });
    },
    async open({ installCode, sealed }): Promise<string> {
      const key = await deriveSealKey({ installCode });
      const bytes = decodeBase64Url({ value: sealed });
      const initializationVector = bytes.slice(0, SEAL_INITIALIZATION_VECTOR_BYTES);
      const cipherText = bytes.slice(SEAL_INITIALIZATION_VECTOR_BYTES);
      const plainText = await crypto.subtle.decrypt({ name: SEAL_CIPHER, iv: initializationVector }, key, cipherText);
      return new TextDecoder().decode(plainText);
    },
  };
}
