import { WebLanguageTag, WebLocale } from '@zapbip/types';

export type LocaleProfile = {
  languageTag: WebLanguageTag;
  openGraphLocale: string;
  turnstileLanguage: string;
  shortName: string;
  nativeName: string;
  docsPath: string;
};

export const LOCALE_PROFILES: Record<WebLocale, LocaleProfile> = {
  [WebLocale.EnglishUs]: {
    languageTag: WebLanguageTag.English,
    openGraphLocale: 'en_US',
    turnstileLanguage: 'en',
    shortName: 'EN',
    nativeName: 'English',
    docsPath: '',
  },
  [WebLocale.PortugueseBrazil]: {
    languageTag: WebLanguageTag.PortugueseBrazil,
    openGraphLocale: 'pt_BR',
    turnstileLanguage: 'pt-br',
    shortName: 'PT',
    nativeName: 'Português',
    docsPath: '/pt-br',
  },
  [WebLocale.Spanish]: {
    languageTag: WebLanguageTag.Spanish,
    openGraphLocale: 'es_ES',
    turnstileLanguage: 'es',
    shortName: 'ES',
    nativeName: 'Español',
    docsPath: '/es',
  },
  [WebLocale.German]: {
    languageTag: WebLanguageTag.German,
    openGraphLocale: 'de_DE',
    turnstileLanguage: 'de',
    shortName: 'DE',
    nativeName: 'Deutsch',
    docsPath: '/de',
  },
  [WebLocale.French]: {
    languageTag: WebLanguageTag.French,
    openGraphLocale: 'fr_FR',
    turnstileLanguage: 'fr',
    shortName: 'FR',
    nativeName: 'Français',
    docsPath: '/fr',
  },
  [WebLocale.Japanese]: {
    languageTag: WebLanguageTag.Japanese,
    openGraphLocale: 'ja_JP',
    turnstileLanguage: 'ja',
    shortName: 'JA',
    nativeName: '日本語',
    docsPath: '/ja',
  },
  [WebLocale.Korean]: {
    languageTag: WebLanguageTag.Korean,
    openGraphLocale: 'ko_KR',
    turnstileLanguage: 'ko',
    shortName: 'KO',
    nativeName: '한국어',
    docsPath: '/ko',
  },
  [WebLocale.ChineseSimplified]: {
    languageTag: WebLanguageTag.ChineseSimplified,
    openGraphLocale: 'zh_CN',
    turnstileLanguage: 'zh-cn',
    shortName: 'ZH',
    nativeName: '简体中文',
    docsPath: '/zh',
  },
};

export const MENU_LOCALES = Object.keys(LOCALE_PROFILES) as WebLocale[];

export function languageOf(input: { locale: WebLocale }): WebLanguageTag {
  return LOCALE_PROFILES[input.locale].languageTag;
}
