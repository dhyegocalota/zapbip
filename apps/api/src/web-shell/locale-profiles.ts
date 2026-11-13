import { DocsLanguage, OwnerLocale } from '@zapbip/types';

export type LocaleProfile = {
  languageTag: DocsLanguage;
  shortName: string;
  nativeName: string;
  docsPath: string;
};

export const LOCALE_PROFILES: Record<OwnerLocale, LocaleProfile> = {
  [OwnerLocale.EnglishUs]: { languageTag: DocsLanguage.English, shortName: 'EN', nativeName: 'English', docsPath: '' },
  [OwnerLocale.PortugueseBrazil]: {
    languageTag: DocsLanguage.PortugueseBrazil,
    shortName: 'PT',
    nativeName: 'Português',
    docsPath: '/pt-br',
  },
};

export const MENU_LOCALES = Object.keys(LOCALE_PROFILES) as OwnerLocale[];

export function languageOf(input: { locale: OwnerLocale }): DocsLanguage {
  return LOCALE_PROFILES[input.locale].languageTag;
}
