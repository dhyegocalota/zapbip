import { encodeHex } from './encoding';

export async function hashConnectionSecret(input: { secret: string }): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.secret));
  return encodeHex({ bytes: new Uint8Array(digest) });
}
