import type { Bindings } from '../contract/env';

function isSet(input: { value: string | undefined }): boolean {
  return input.value !== undefined && input.value.trim() !== '';
}

export function isWaitlistOpen(input: { env: Bindings }): boolean {
  return isSet({ value: input.env.TURNSTILE_SECRET_KEY }) && isSet({ value: input.env.TURNSTILE_SITE_KEY });
}
