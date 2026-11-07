import type { Bindings } from '../contract/env';

export function readDevelopmentMediaOrigin(input: { env: Bindings }): string | null {
  const value = input.env.WHATSAPP_MEDIA_DOWNLOAD_ORIGIN;
  if (value === undefined || value.length === 0) return null;
  return value;
}
