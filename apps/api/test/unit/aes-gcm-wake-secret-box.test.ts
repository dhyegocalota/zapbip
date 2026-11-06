import { WAKE_IV_BYTES, WAKE_SEALED_KEY_VERSION, WAKE_SECRET_KEY_BYTES } from '@zapbip/core';
import { describe, expect, it } from 'vitest';
import { createAesGcmWakeSecretBox } from '../../src/adapters/wake/aes-gcm-wake-secret-box';

const BASE64 = 'base64';
const PLAIN = '{"url":"https://api2.cursor.sh/automations/webhook/abc12345","token":"token-with-sixteen-chars"}';
const ASSOCIATED_DATA = 'acc_1:agent-a';
const OTHER_ASSOCIATED_DATA = 'acc_1:agent-b';
const UNSUPPORTED_KEY_VERSION = 2;
const SHORT_KEY_BYTES = 31;
const VERSION_BYTE_COUNT = 1;
const KEY_NAME = 'WAKE_SECRET_KEY';

function keyOf(input: { bytes: number }): string {
  return Buffer.alloc(input.bytes, 7).toString(BASE64);
}

function secretBox() {
  return createAesGcmWakeSecretBox({ base64Key: keyOf({ bytes: WAKE_SECRET_KEY_BYTES }) });
}

function sealPlain() {
  return secretBox().seal({ plain: PLAIN, associatedData: ASSOCIATED_DATA });
}

function rewrite(input: { sealed: string; change: (bytes: Buffer) => void }): string {
  const bytes = Buffer.from(input.sealed, BASE64);
  input.change(bytes);
  return bytes.toString(BASE64);
}

describe('createAesGcmWakeSecretBox', () => {
  it('opens what it sealed', async () => {
    const sealed = await sealPlain();
    expect(await secretBox().open({ sealed, associatedData: ASSOCIATED_DATA })).toBe(PLAIN);
  });

  it('seals the same plain text to different values', async () => {
    expect(await sealPlain()).not.toBe(await sealPlain());
  });

  it('starts the sealed value with the key version and the initialisation vector', async () => {
    const bytes = Buffer.from(await sealPlain(), BASE64);
    expect(bytes[0]).toBe(WAKE_SEALED_KEY_VERSION);
    expect(bytes.length).toBeGreaterThan(VERSION_BYTE_COUNT + WAKE_IV_BYTES);
  });

  it('does not open a value with one flipped byte', async () => {
    const sealed = await sealPlain();
    const tampered = rewrite({
      sealed,
      change: (bytes) => {
        const middle = Math.floor(bytes.length / 2);
        bytes.writeUInt8(bytes.readUInt8(middle) ^ 1, middle);
      },
    });
    expect(await secretBox().open({ sealed: tampered, associatedData: ASSOCIATED_DATA })).toBeNull();
  });

  it('does not open a value under other associated data', async () => {
    const sealed = await sealPlain();
    expect(await secretBox().open({ sealed, associatedData: OTHER_ASSOCIATED_DATA })).toBeNull();
  });

  it('does not open a value under another key', async () => {
    const sealed = await sealPlain();
    const otherBox = createAesGcmWakeSecretBox({ base64Key: Buffer.alloc(WAKE_SECRET_KEY_BYTES, 9).toString(BASE64) });
    expect(await otherBox.open({ sealed, associatedData: ASSOCIATED_DATA })).toBeNull();
  });

  it('does not open a value with another key version', async () => {
    const sealed = await sealPlain();
    const rewritten = rewrite({
      sealed,
      change: (bytes) => {
        bytes[0] = UNSUPPORTED_KEY_VERSION;
      },
    });
    expect(await secretBox().open({ sealed: rewritten, associatedData: ASSOCIATED_DATA })).toBeNull();
  });

  it('does not open a value too short to hold a vector', async () => {
    expect(
      await secretBox().open({ sealed: Buffer.from([WAKE_SEALED_KEY_VERSION]).toString(BASE64), associatedData: ASSOCIATED_DATA }),
    ).toBeNull();
  });

  it('throws naming the key when it has 31 bytes', () => {
    expect(() => createAesGcmWakeSecretBox({ base64Key: keyOf({ bytes: SHORT_KEY_BYTES }) })).toThrow(KEY_NAME);
  });

  it('throws naming the key when it is absent', () => {
    expect(() => createAesGcmWakeSecretBox({ base64Key: undefined as unknown as string })).toThrow(KEY_NAME);
  });
});
