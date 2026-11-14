import { OwnerLocale } from '@zapbip/types';

export type LocaleCopies = Record<OwnerLocale, Record<string, string>>;

const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;
const FRENCH_SPACE_BEFORE_PUNCTUATION = / [:;?!»]|« /;
const CJK_SPACED_PAIR = /[぀-ヿ㐀-鿿] [぀-ヿ㐀-鿿]/;
const NON_ENGLISH_LOCALES = Object.values(OwnerLocale).filter((locale) => locale !== OwnerLocale.EnglishUs);

export function placeholdersOf(input: { text: string }): string {
  return [...input.text.matchAll(PLACEHOLDER_PATTERN)]
    .map((match) => match[1]!)
    .sort()
    .join();
}

export function emptyEntries(input: { copies: LocaleCopies; keys: string[] }): string[] {
  const { copies, keys } = input;
  return Object.values(OwnerLocale).flatMap((locale) =>
    keys
      .filter((key) => typeof copies[locale][key] !== 'string' || copies[locale][key]!.trim().length === 0)
      .map((key) => `${locale}:${key}`),
  );
}

export function placeholderMismatches(input: { copies: LocaleCopies; keys: string[] }): string[] {
  const { copies, keys } = input;
  return NON_ENGLISH_LOCALES.flatMap((locale) =>
    keys
      .filter((key) => placeholdersOf({ text: copies[locale][key]! }) !== placeholdersOf({ text: copies[OwnerLocale.EnglishUs][key]! }))
      .map((key) => `${locale}:${key}`),
  );
}

export function untranslatedEntries(input: { copies: LocaleCopies; keys: string[]; allowed: string[] }): string[] {
  const { copies, keys, allowed } = input;
  return NON_ENGLISH_LOCALES.flatMap((locale) =>
    keys
      .filter(
        (key) =>
          !allowed.includes(key) && !allowed.includes(`${locale}:${key}`) && copies[locale][key] === copies[OwnerLocale.EnglishUs][key],
      )
      .map((key) => `${locale}:${key}`),
  );
}

export function frenchSpacingOffenders(input: { texts: string[] }): string[] {
  return input.texts.filter((text) => FRENCH_SPACE_BEFORE_PUNCTUATION.test(text));
}

export function cjkSpacingOffenders(input: { texts: string[] }): string[] {
  return input.texts.filter((text) => CJK_SPACED_PAIR.test(text));
}
