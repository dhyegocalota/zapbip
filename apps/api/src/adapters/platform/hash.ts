import { encodeHex } from './encoding';

const DIGEST_ALGORITHM = 'SHA-256';
const BASE64_ENCODING = 'base64';

export async function sha256Hex(input: { value: string }): Promise<string> {
  const digest = await crypto.subtle.digest(DIGEST_ALGORITHM, new TextEncoder().encode(input.value));
  return encodeHex({ bytes: new Uint8Array(digest) });
}

export async function sha256Base64(input: { bytes: ArrayBuffer }): Promise<string> {
  const digest = await crypto.subtle.digest(DIGEST_ALGORITHM, input.bytes);
  return Buffer.from(digest).toString(BASE64_ENCODING);
}

export function hashConnectionSecret(input: { secret: string }): Promise<string> {
  return sha256Hex({ value: input.secret });
}
