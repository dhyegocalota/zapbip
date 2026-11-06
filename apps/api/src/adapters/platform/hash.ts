import { encodeHex } from './encoding';

export async function hashConnectionSecret(input: { secret: string }): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.secret));
  return encodeHex({ bytes: new Uint8Array(digest) });
}

export function sha256Hex(input: { value: string }): Promise<string> {
  void input;
  throw new Error('sha256Hex is not implemented');
}

export function sha256Base64(input: { bytes: ArrayBuffer }): Promise<string> {
  void input;
  throw new Error('sha256Base64 is not implemented');
}
