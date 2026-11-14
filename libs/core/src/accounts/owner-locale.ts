import { OWNER_LOCALE_BY_CALLING_CODE, OwnerLocale, START_PREFILLED_TEXT } from '@zapbip/types';
import { commandWordLocaleOf } from './command';

const CALLING_CODES_LONGEST_FIRST = Object.keys(OWNER_LOCALE_BY_CALLING_CODE).sort((first, second) => second.length - first.length);
const LANGUAGE_SEPARATOR_PATTERN = /_/g;
const OWNER_LOCALES = Object.values(OwnerLocale);
const SCRIPT_LOCALES: readonly { pattern: RegExp; locale: OwnerLocale }[] = [
  { pattern: /\p{Script=Hangul}/u, locale: OwnerLocale.Korean },
  { pattern: /[\p{Script=Hiragana}\p{Script=Katakana}]/u, locale: OwnerLocale.Japanese },
  { pattern: /\p{Script=Arabic}/u, locale: OwnerLocale.Arabic },
  { pattern: /\p{Script=Devanagari}/u, locale: OwnerLocale.Hindi },
];

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
  ar: OwnerLocale.Arabic,
  hi: OwnerLocale.Hindi,
};

function ownerLocaleOfCallingCode(input: { waId: string }): OwnerLocale | null {
  const callingCode = CALLING_CODES_LONGEST_FIRST.find((code) => input.waId.startsWith(code));
  return callingCode === undefined ? null : OWNER_LOCALE_BY_CALLING_CODE[callingCode]!;
}

function ownerLocaleOfWrittenText(input: { text: string | null }): OwnerLocale | null {
  if (input.text === null) return null;
  const trimmedText = input.text.trim();
  const prefilledLocale = OWNER_LOCALES.find((locale) => trimmedText.startsWith(START_PREFILLED_TEXT[locale]));
  if (prefilledLocale !== undefined) return prefilledLocale;
  const commandLocale = commandWordLocaleOf({ text: trimmedText });
  if (commandLocale !== null) return commandLocale;
  const scriptLocale = SCRIPT_LOCALES.find(({ pattern }) => pattern.test(trimmedText));
  return scriptLocale === undefined ? null : scriptLocale.locale;
}

export function ownerLocaleOf(input: { waId: string; writtenText: string | null }): OwnerLocale {
  const writtenLocale = ownerLocaleOfWrittenText({ text: input.writtenText });
  if (writtenLocale !== null) return writtenLocale;
  const callingCodeLocale = ownerLocaleOfCallingCode({ waId: input.waId });
  if (callingCodeLocale !== null) return callingCodeLocale;
  return OwnerLocale.EnglishUs;
}

export function ownerLanguageOfValue(input: { value: string }): OwnerLocale | null {
  const normalized = input.value.trim().toLowerCase().replace(LANGUAGE_SEPARATOR_PATTERN, '-');
  return Object.hasOwn(OWNER_LOCALES_BY_LANGUAGE_VALUE, normalized) ? OWNER_LOCALES_BY_LANGUAGE_VALUE[normalized]! : null;
}
