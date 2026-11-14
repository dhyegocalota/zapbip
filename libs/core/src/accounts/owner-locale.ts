import { OWNER_LOCALE_BY_CALLING_CODE, OwnerLocale } from '@zapbip/types';

const CALLING_CODES_LONGEST_FIRST = Object.keys(OWNER_LOCALE_BY_CALLING_CODE).sort((first, second) => second.length - first.length);
const LANGUAGE_SEPARATOR_PATTERN = /_/g;

const OWNER_LOCALES_BY_LANGUAGE_VALUE: Record<string, OwnerLocale> = {
  en: OwnerLocale.EnglishUs,
  'en-us': OwnerLocale.EnglishUs,
  pt: OwnerLocale.PortugueseBrazil,
  'pt-br': OwnerLocale.PortugueseBrazil,
  es: OwnerLocale.Spanish,
  de: OwnerLocale.German,
  fr: OwnerLocale.French,
  ja: OwnerLocale.Japanese,
  ko: OwnerLocale.Korean,
  zh: OwnerLocale.ChineseSimplified,
  'zh-cn': OwnerLocale.ChineseSimplified,
};

export function ownerLocaleOf(input: { waId: string }): OwnerLocale {
  const callingCode = CALLING_CODES_LONGEST_FIRST.find((code) => input.waId.startsWith(code));
  return callingCode === undefined ? OwnerLocale.EnglishUs : OWNER_LOCALE_BY_CALLING_CODE[callingCode]!;
}

export function ownerLanguageOfValue(input: { value: string }): OwnerLocale | null {
  const normalized = input.value.trim().toLowerCase().replace(LANGUAGE_SEPARATOR_PATTERN, '-');
  return Object.hasOwn(OWNER_LOCALES_BY_LANGUAGE_VALUE, normalized) ? OWNER_LOCALES_BY_LANGUAGE_VALUE[normalized]! : null;
}
