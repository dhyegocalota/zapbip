import { DEFAULT_LOCALE, WEB_LOCALE_OF_OWNER_LOCALE, WebLocale } from '@zapbip/types';
import { ENGLISH_LANGUAGE_PREFIX } from './backoffice-constants';

const LOCALE_VALUES: string[] = Object.values(WebLocale);

export function resolveLocale(input: { cookieValue: string | undefined; acceptLanguage: string | undefined }): WebLocale {
  const { cookieValue, acceptLanguage } = input;
  if (cookieValue !== undefined && LOCALE_VALUES.includes(cookieValue)) return cookieValue as WebLocale;
  if (acceptLanguage !== undefined && acceptLanguage.toLowerCase().startsWith(ENGLISH_LANGUAGE_PREFIX)) return WebLocale.EnglishUs;
  return WEB_LOCALE_OF_OWNER_LOCALE[DEFAULT_LOCALE];
}
