import type { Bindings } from '../contract/env';

export function turnstileSecretOf(input: { env: Bindings }): string | null {
  const { TURNSTILE_SECRET_KEY: secret, TURNSTILE_SITE_KEY: siteKey } = input.env;
  if (secret === undefined || secret.trim() === '' || siteKey.trim() === '') return null;
  return secret.trim();
}

export function isWaitlistOpen(input: { env: Bindings }): boolean {
  return turnstileSecretOf(input) !== null;
}
