import { CLIENT_APP_LOCALE_PATH_PREFIXES, OwnerLocale } from '@zapbip/types';
import { LOCALE_PROFILES } from '../web-shell/locale-profiles';
import { SitePath } from './site-paths';

const PATHS_BY_LOCALE = Object.fromEntries(
  Object.values(OwnerLocale).map((locale) => [locale, CLIENT_APP_LOCALE_PATH_PREFIXES[locale] || SitePath.Home]),
) as Record<OwnerLocale, string>;
const LOCALES_BY_VALUE: Record<string, OwnerLocale> = Object.fromEntries(
  Object.values(OwnerLocale).flatMap((locale) => [
    [locale, locale],
    [LOCALE_PROFILES[locale].languageTag, locale],
  ]),
);
const LOCALE_VALUES: string[] = Object.values(OwnerLocale);
const LOCALES_BY_PRIMARY_LANGUAGE: Record<string, OwnerLocale> = {
  en: OwnerLocale.EnglishUs,
  pt: OwnerLocale.PortugueseBrazil,
  es: OwnerLocale.Spanish,
  de: OwnerLocale.German,
  fr: OwnerLocale.French,
  ja: OwnerLocale.Japanese,
  ko: OwnerLocale.Korean,
  zh: OwnerLocale.ChineseSimplified,
};
const TRADITIONAL_CHINESE_SUBTAGS = ['hant', 'tw', 'hk', 'mo'];
const TRADITIONAL_CHINESE_PRIMARY_LANGUAGE = 'zh';
const LANGUAGE_RANGE_SEPARATOR = ',';
const PARAMETER_SEPARATOR = ';';
const SUBTAG_SEPARATOR = '-';
const QUALITY_PREFIX = 'q=';
const DEFAULT_QUALITY = 1;

type LanguagePreference = { tag: string; quality: number };

function qualityOf(input: { parameters: string[] }): number {
  const parameter = input.parameters.map((candidate) => candidate.trim()).find((candidate) => candidate.startsWith(QUALITY_PREFIX));
  return parameter === undefined ? DEFAULT_QUALITY : Number(parameter.slice(QUALITY_PREFIX.length));
}

function preferencesOf(input: { acceptLanguage: string }): LanguagePreference[] {
  return input.acceptLanguage
    .split(LANGUAGE_RANGE_SEPARATOR)
    .map((range) => {
      const [tag, ...parameters] = range.trim().toLowerCase().split(PARAMETER_SEPARATOR);
      return { tag: tag!.trim(), quality: qualityOf({ parameters }) };
    })
    .filter((preference) => preference.quality > 0)
    .sort((first, second) => second.quality - first.quality);
}

function localeOfLanguageTag(input: { tag: string }): OwnerLocale | null {
  const [primary, ...subtags] = input.tag.split(SUBTAG_SEPARATOR);
  if (primary === undefined || !Object.hasOwn(LOCALES_BY_PRIMARY_LANGUAGE, primary)) return null;
  const isTraditionalChinese =
    primary === TRADITIONAL_CHINESE_PRIMARY_LANGUAGE && subtags.some((subtag) => TRADITIONAL_CHINESE_SUBTAGS.includes(subtag));
  return isTraditionalChinese ? null : LOCALES_BY_PRIMARY_LANGUAGE[primary]!;
}

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
  if (acceptLanguage === undefined) return OwnerLocale.EnglishUs;
  const accepted = preferencesOf({ acceptLanguage })
    .map((preference) => localeOfLanguageTag({ tag: preference.tag }))
    .filter((locale): locale is OwnerLocale => locale !== null);
  return accepted.length === 0 ? OwnerLocale.EnglishUs : accepted[0]!;
}
