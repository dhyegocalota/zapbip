import { WHATSAPP_MEDIA_HOST_SUFFIXES } from './whatsapp-constants';

const HTTPS_PROTOCOL = 'https:';

export function isAllowedMediaUrl(input: { url: string; developmentMediaOrigin: string | null }): boolean {
  const parsed = URL.parse(input.url);
  if (parsed === null) return false;
  if (parsed.origin === input.developmentMediaOrigin) return true;
  if (parsed.protocol !== HTTPS_PROTOCOL) return false;
  return WHATSAPP_MEDIA_HOST_SUFFIXES.some((suffix) => parsed.hostname === suffix || parsed.hostname.endsWith(`.${suffix}`));
}
