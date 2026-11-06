import { WEBHOOK_SIGNATURE_PREFIX } from '../../../../src/adapters/whatsapp/whatsapp-constants';
import { encodeHex } from '../../../../src/adapters/platform/encoding';

const HMAC_ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };

export async function signatureHeaderOf(input: { appSecret: string; body: Uint8Array }): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.appSecret), HMAC_ALGORITHM, false, ['sign']);
  const digest = await crypto.subtle.sign(HMAC_ALGORITHM.name, key, input.body);
  return `${WEBHOOK_SIGNATURE_PREFIX}${encodeHex({ bytes: new Uint8Array(digest) })}`;
}
