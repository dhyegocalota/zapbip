import type { LinkPurpose } from '@zapbip/types';
import { decodeBase64Url, encodeBase64Url } from './adapters/platform/encoding';

const HMAC_ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };

type LinkClaims = { accountId: string; mediaId: string; purpose: LinkPurpose; expiresAt: number };

export function canonicalLinkString(input: LinkClaims): string {
  return [input.purpose, input.accountId, input.mediaId, String(input.expiresAt)].join('\n');
}

function importSigningKey(input: { key: string; usage: 'sign' | 'verify' }): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(input.key), HMAC_ALGORITHM, false, [input.usage]);
}

export async function signLink(input: LinkClaims & { key: string }): Promise<string> {
  const signingKey = await importSigningKey({ key: input.key, usage: 'sign' });
  const signature = await crypto.subtle.sign(HMAC_ALGORITHM.name, signingKey, new TextEncoder().encode(canonicalLinkString(input)));
  return encodeBase64Url({ bytes: new Uint8Array(signature) });
}

export async function verifyLink(input: LinkClaims & { key: string; signature: string; now: number }): Promise<boolean> {
  const isExpired = input.now > input.expiresAt;
  if (isExpired) return false;
  const signingKey = await importSigningKey({ key: input.key, usage: 'verify' });
  const signatureBytes = decodeBase64Url({ value: input.signature });
  return crypto.subtle.verify(HMAC_ALGORITHM.name, signingKey, signatureBytes, new TextEncoder().encode(canonicalLinkString(input)));
}

export function readSignedQuery(input: {
  expiry: string | undefined;
  signature: string | undefined;
}): { expiresAt: number; signature: string } | null {
  throw new Error('readSignedQuery is not implemented');
}
