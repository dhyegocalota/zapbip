import { DEFAULT_LOCALE, OwnerLocale } from '@zapbip/types';
import { ENGLISH_LANGUAGE_PREFIX } from './backoffice-constants';

const LOCALE_VALUES: string[] = Object.values(OwnerLocale);

export function resolveLocale(input: { cookieValue: string | undefined; acceptLanguage: string | undefined }): OwnerLocale {
  const { cookieValue, acceptLanguage } = input;
  if (cookieValue !== undefined && LOCALE_VALUES.includes(cookieValue)) return cookieValue as OwnerLocale;
  if (acceptLanguage !== undefined && acceptLanguage.toLowerCase().startsWith(ENGLISH_LANGUAGE_PREFIX)) return OwnerLocale.EnglishUs;
  return DEFAULT_LOCALE;
}
