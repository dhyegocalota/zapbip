import { WAKE_SECRET_KEY_BYTES } from '@zapbip/core';
import { describe, expect, it } from 'vitest';
import { createAesGcmSecretBox } from '../../src/adapters/platform/aes-gcm-secret-box';

const BASE64 = 'base64';
const KEY_NAME = 'NUMBER_REGISTRY_KEY';
const PLAIN = 'EAAG-access-token-0123456789';
const ASSOCIATED_DATA = 'whatsapp_numbers:num_1:access_token';
const OTHER_ASSOCIATED_DATA = 'whatsapp_numbers:num_2:access_token';
const UNSUPPORTED_KEY_VERSION = 2;
const SHORT_KEY_BYTES = 31;

function keyOf(input: { bytes: number }): string {
  return Buffer.alloc(input.bytes, 7).toString(BASE64);
}

function secretBox() {
  return createAesGcmSecretBox({ base64Key: keyOf({ bytes: WAKE_SECRET_KEY_BYTES }), keyName: KEY_NAME });
}

describe('createAesGcmSecretBox', () => {
  it('opens what it sealed', async () => {
    const sealed = await secretBox().seal({ plain: PLAIN, associatedData: ASSOCIATED_DATA });
    expect(await secretBox().open({ sealed, associatedData: ASSOCIATED_DATA })).toBe(PLAIN);
  });

  it('does not open a value under other associated data', async () => {
    const sealed = await secretBox().seal({ plain: PLAIN, associatedData: ASSOCIATED_DATA });
    expect(await secretBox().open({ sealed, associatedData: OTHER_ASSOCIATED_DATA })).toBeNull();
  });

  it('does not open a value with another version byte', async () => {
    const sealed = await secretBox().seal({ plain: PLAIN, associatedData: ASSOCIATED_DATA });
    const bytes = Buffer.from(sealed, BASE64);
    bytes[0] = UNSUPPORTED_KEY_VERSION;
    expect(await secretBox().open({ sealed: bytes.toString(BASE64), associatedData: ASSOCIATED_DATA })).toBeNull();
  });

  it('rejects a key of the wrong length naming the key from the parameter', async () => {
    const box = createAesGcmSecretBox({ base64Key: keyOf({ bytes: SHORT_KEY_BYTES }), keyName: KEY_NAME });
    await expect(box.seal({ plain: PLAIN, associatedData: ASSOCIATED_DATA })).rejects.toThrow(
      `${KEY_NAME} must be ${WAKE_SECRET_KEY_BYTES} bytes encoded in base64`,
    );
  });
});
