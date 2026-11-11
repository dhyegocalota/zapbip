import { WEBHOOK_SIGNATURE_PREFIX } from './whatsapp-constants';

const HMAC_ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };
const HEX_DIGEST_PATTERN = /^[0-9a-f]{64}$/;

export async function verifyWebhookSignature(input: {
  appSecret: string | undefined;
  rawBody: ArrayBuffer;
  signatureHeader: string | null;
}): Promise<boolean> {
  const { appSecret, signatureHeader } = input;
  const isBlankSecret = appSecret === undefined || appSecret.trim() === '';
  if (isBlankSecret) return false;
  if (signatureHeader === null) return false;
  if (!signatureHeader.startsWith(WEBHOOK_SIGNATURE_PREFIX)) return false;
  const digestHex = signatureHeader.slice(WEBHOOK_SIGNATURE_PREFIX.length);
  if (!HEX_DIGEST_PATTERN.test(digestHex)) return false;
  const verifyingKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), HMAC_ALGORITHM, false, ['verify']);
  return crypto.subtle.verify(HMAC_ALGORITHM.name, verifyingKey, Buffer.from(digestHex, 'hex'), input.rawBody);
}
