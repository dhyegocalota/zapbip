import { encodeBase64Url } from '../adapters/platform/encoding';
import { constantTimeEqual } from '../backoffice/auth/constant-time';
import { CSRF_CONTEXT } from './client-app-constants';

const HMAC_ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };

export async function csrfTokenOf(input: { secret: string }): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.secret), HMAC_ALGORITHM, false, ['sign']);
  const signature = await crypto.subtle.sign(HMAC_ALGORITHM.name, key, new TextEncoder().encode(CSRF_CONTEXT));
  return encodeBase64Url({ bytes: new Uint8Array(signature) });
}

export async function isCsrfTokenValid(input: { secret: string; submittedToken: string }): Promise<boolean> {
  return constantTimeEqual({ left: await csrfTokenOf({ secret: input.secret }), right: input.submittedToken });
}
