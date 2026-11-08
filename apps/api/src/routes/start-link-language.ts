import { DEFAULT_LOCALE, DocsLanguage, OwnerLocale } from '@zapbip/types';

const LOCALE_BY_LANGUAGE: Record<DocsLanguage, OwnerLocale> = {
  [DocsLanguage.English]: OwnerLocale.EnglishUs,
  [DocsLanguage.PortugueseBrazil]: OwnerLocale.PortugueseBrazil,
};

function isDocsLanguage(value: string | undefined): value is DocsLanguage {
  return Object.values<string | undefined>(DocsLanguage).includes(value);
}

export function startLinkLocaleOf(input: { values: string[] | undefined }): OwnerLocale | null {
  if (input.values === undefined) return DEFAULT_LOCALE;
  const [language] = input.values;
  const isSingleKnownLanguage = input.values.length === 1 && isDocsLanguage(language);
  if (!isSingleKnownLanguage) return null;
  return LOCALE_BY_LANGUAGE[language];
}
