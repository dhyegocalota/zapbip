import { encodeBase64Url } from '../../adapters/platform/encoding';
import { CSRF_CONTEXT } from '../backoffice-constants';
import { constantTimeEqual } from './constant-time';

const HMAC_ALGORITHM = { name: 'HMAC', hash: 'SHA-256' };

export async function csrfTokenOf(input: { sessionToken: string }): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.sessionToken), HMAC_ALGORITHM, false, ['sign']);
  const signature = await crypto.subtle.sign(HMAC_ALGORITHM.name, key, new TextEncoder().encode(CSRF_CONTEXT));
  return encodeBase64Url({ bytes: new Uint8Array(signature) });
}

export async function isSessionCsrfTokenValid(input: { sessionToken: string; submittedToken: string }): Promise<boolean> {
  return constantTimeEqual({ left: await csrfTokenOf({ sessionToken: input.sessionToken }), right: input.submittedToken });
}
