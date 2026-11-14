import { WebLanguageTag, OwnerLocale } from '@zapbip/types';

export enum TextDirection {
  LeftToRight = 'ltr',
  RightToLeft = 'rtl',
}

export type LocaleProfile = {
  languageTag: WebLanguageTag;
  formattingLocale: string;
  textDirection: TextDirection;
  openGraphLocale: string;
  turnstileLanguage: string;
  shortName: string;
  nativeName: string;
  docsPath: string;
};

export const LOCALE_PROFILES: Record<OwnerLocale, LocaleProfile> = {
  [OwnerLocale.EnglishUs]: {
    languageTag: WebLanguageTag.English,
    formattingLocale: WebLanguageTag.English,
    textDirection: TextDirection.LeftToRight,
    openGraphLocale: 'en_US',
    turnstileLanguage: 'en',
    shortName: 'EN',
    nativeName: 'English',
    docsPath: '',
  },
  [OwnerLocale.PortugueseBrazil]: {
    languageTag: WebLanguageTag.PortugueseBrazil,
    formattingLocale: WebLanguageTag.PortugueseBrazil,
    textDirection: TextDirection.LeftToRight,
    openGraphLocale: 'pt_BR',
    turnstileLanguage: 'pt-br',
    shortName: 'PT',
    nativeName: 'Português',
    docsPath: '/pt-br',
  },
  [OwnerLocale.Spanish]: {
    languageTag: WebLanguageTag.Spanish,
    formattingLocale: WebLanguageTag.Spanish,
    textDirection: TextDirection.LeftToRight,
    openGraphLocale: 'es_ES',
    turnstileLanguage: 'es',
    shortName: 'ES',
    nativeName: 'Español',
    docsPath: '/es',
  },
  [OwnerLocale.German]: {
    languageTag: WebLanguageTag.German,
    formattingLocale: WebLanguageTag.German,
    textDirection: TextDirection.LeftToRight,
    openGraphLocale: 'de_DE',
    turnstileLanguage: 'de',
    shortName: 'DE',
    nativeName: 'Deutsch',
    docsPath: '/de',
  },
  [OwnerLocale.French]: {
    languageTag: WebLanguageTag.French,
    formattingLocale: WebLanguageTag.French,
    textDirection: TextDirection.LeftToRight,
    openGraphLocale: 'fr_FR',
    turnstileLanguage: 'fr',
    shortName: 'FR',
    nativeName: 'Français',
    docsPath: '/fr',
  },
  [OwnerLocale.Japanese]: {
    languageTag: WebLanguageTag.Japanese,
    formattingLocale: WebLanguageTag.Japanese,
    textDirection: TextDirection.LeftToRight,
    openGraphLocale: 'ja_JP',
    turnstileLanguage: 'ja',
    shortName: 'JA',
    nativeName: '日本語',
    docsPath: '/ja',
  },
  [OwnerLocale.Korean]: {
    languageTag: WebLanguageTag.Korean,
    formattingLocale: WebLanguageTag.Korean,
    textDirection: TextDirection.LeftToRight,
    openGraphLocale: 'ko_KR',
    turnstileLanguage: 'ko',
    shortName: 'KO',
    nativeName: '한국어',
    docsPath: '/ko',
  },
  [OwnerLocale.ChineseSimplified]: {
    languageTag: WebLanguageTag.ChineseSimplified,
    formattingLocale: WebLanguageTag.ChineseSimplified,
    textDirection: TextDirection.LeftToRight,
    openGraphLocale: 'zh_CN',
    turnstileLanguage: 'zh-cn',
    shortName: 'ZH',
    nativeName: '简体中文',
    docsPath: '/zh',
  },
  [OwnerLocale.Arabic]: {
    languageTag: WebLanguageTag.Arabic,
    formattingLocale: 'ar-u-nu-latn',
    textDirection: TextDirection.RightToLeft,
    openGraphLocale: 'ar_AR',
    turnstileLanguage: 'ar',
    shortName: 'AR',
    nativeName: 'العربية',
    docsPath: '/ar',
  },
  [OwnerLocale.Hindi]: {
    languageTag: WebLanguageTag.Hindi,
    formattingLocale: WebLanguageTag.Hindi,
    textDirection: TextDirection.LeftToRight,
    openGraphLocale: 'hi_IN',
    turnstileLanguage: 'hi',
    shortName: 'HI',
    nativeName: 'हिन्दी',
    docsPath: '/hi',
  },
};

export const MENU_LOCALES = Object.keys(LOCALE_PROFILES) as OwnerLocale[];

export function languageOf(input: { locale: OwnerLocale }): WebLanguageTag {
  return LOCALE_PROFILES[input.locale].languageTag;
}

export function textDirectionOf(input: { locale: OwnerLocale }): TextDirection {
  return LOCALE_PROFILES[input.locale].textDirection;
}

export function formattingLocaleOf(input: { locale: OwnerLocale }): string {
  return LOCALE_PROFILES[input.locale].formattingLocale;
}
