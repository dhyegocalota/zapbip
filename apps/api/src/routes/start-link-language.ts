import { DOCS_OWNER_LOCALES, DocsPageLanguage, OwnerLocale } from '@zapbip/types';

function isDocsLanguage(value: string | undefined): value is DocsPageLanguage {
  return Object.values<string | undefined>(DocsPageLanguage).includes(value);
}

export function startLinkLocaleOf(input: { values: string[] | undefined }): OwnerLocale | null {
  if (input.values === undefined) return OwnerLocale.EnglishUs;
  const [language] = input.values;
  const isSingleKnownLanguage = input.values.length === 1 && isDocsLanguage(language);
  if (!isSingleKnownLanguage) return null;
  return DOCS_OWNER_LOCALES[language];
}
