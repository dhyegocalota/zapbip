import { DocsLanguage, OwnerLocale } from '@zapbip/types';
import { SitePath } from './site-paths';

const PATHS_BY_LOCALE: Record<OwnerLocale, string> = {
  [OwnerLocale.EnglishUs]: SitePath.Home,
  [OwnerLocale.PortugueseBrazil]: SitePath.PortugueseHome,
};
const LOCALES_BY_VALUE: Record<string, OwnerLocale> = {
  [DocsLanguage.English]: OwnerLocale.EnglishUs,
  [OwnerLocale.EnglishUs]: OwnerLocale.EnglishUs,
  [DocsLanguage.PortugueseBrazil]: OwnerLocale.PortugueseBrazil,
  [OwnerLocale.PortugueseBrazil]: OwnerLocale.PortugueseBrazil,
};
const LOCALE_VALUES: string[] = Object.values(OwnerLocale);
const PORTUGUESE_LANGUAGE_PREFIX = 'pt';

export function localePathOf(input: { locale: OwnerLocale }): string {
  return PATHS_BY_LOCALE[input.locale];
}

export function localeOfPath(input: { pathname: string }): OwnerLocale | null {
  const entry = Object.entries(PATHS_BY_LOCALE).find(([, path]) => path === input.pathname);
  return entry === undefined ? null : (entry[0] as OwnerLocale);
}

export function localeOfLanguageValue(input: { value: string | undefined }): OwnerLocale | null {
  const { value } = input;
  return value !== undefined && Object.hasOwn(LOCALES_BY_VALUE, value) ? LOCALES_BY_VALUE[value]! : null;
}

export function preferredLocaleOf(input: { cookieValue: string | undefined; acceptLanguage: string | undefined }): OwnerLocale {
  const { cookieValue, acceptLanguage } = input;
  if (cookieValue !== undefined && LOCALE_VALUES.includes(cookieValue)) return cookieValue as OwnerLocale;
  if (acceptLanguage !== undefined && acceptLanguage.trim().toLowerCase().startsWith(PORTUGUESE_LANGUAGE_PREFIX)) {
    return OwnerLocale.PortugueseBrazil;
  }
  return OwnerLocale.EnglishUs;
}
