import { encodeHex } from './encoding';

async function hashSha256({ value }: { value: string }): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return encodeHex({ bytes: new Uint8Array(digest) });
}

export function hashConnectionSecret(input: { secret: string }): Promise<string> {
  return hashSha256({ value: input.secret });
}

export function hashInstallCode(input: { installCode: string }): Promise<string> {
  return hashSha256({ value: input.installCode });
}
