import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Base64, sha256Hex } from '../../src/adapters/platform/hash';

const ASCII_VALUE = 'wamid.HBgLNTUxMTk5OTk5MDAwMA';
const MULTIBYTE_VALUE = 'olá, ação 🎉';
const HEX_DIGEST_PATTERN = /^[0-9a-f]{64}$/;

function bytesOf(input: { value: string }): ArrayBuffer {
  return new TextEncoder().encode(input.value).slice().buffer;
}

describe('hash digests', () => {
  it('hex-encodes the SHA-256 of an ASCII value', async () => {
    const digest = await sha256Hex({ value: ASCII_VALUE });
    expect(digest).toMatch(HEX_DIGEST_PATTERN);
    expect(digest).toBe(createHash('sha256').update(ASCII_VALUE).digest('hex'));
  });

  it('hex-encodes the SHA-256 of a multibyte value over its UTF-8 bytes', async () => {
    expect(await sha256Hex({ value: MULTIBYTE_VALUE })).toBe(createHash('sha256').update(MULTIBYTE_VALUE, 'utf8').digest('hex'));
  });

  it('gives the same digest to the same value and another to a different one', async () => {
    expect(await sha256Hex({ value: ASCII_VALUE })).toBe(await sha256Hex({ value: ASCII_VALUE }));
    expect(await sha256Hex({ value: ASCII_VALUE })).not.toBe(await sha256Hex({ value: `${ASCII_VALUE}x` }));
  });

  it('base64-encodes the SHA-256 of the bytes with padding', async () => {
    const digest = await sha256Base64({ bytes: bytesOf({ value: MULTIBYTE_VALUE }) });
    expect(digest).toBe(createHash('sha256').update(MULTIBYTE_VALUE, 'utf8').digest('base64'));
    expect(digest).toMatch(/=$/);
  });

  it('base64-encodes the SHA-256 of empty bytes', async () => {
    expect(await sha256Base64({ bytes: new ArrayBuffer(0) })).toBe(createHash('sha256').update('').digest('base64'));
  });
});
