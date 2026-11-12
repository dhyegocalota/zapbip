import { DocsLanguage, OwnerLocale } from '@zapbip/types';
import { SITE_LANGUAGE_PARAMETER, SITE_REFERRAL_PARAMETER } from './site-constants';
import { SitePath } from './site-paths';

const LANGUAGES_BY_LOCALE: Record<OwnerLocale, DocsLanguage> = {
  [OwnerLocale.PortugueseBrazil]: DocsLanguage.PortugueseBrazil,
  [OwnerLocale.EnglishUs]: DocsLanguage.English,
};

export function languageOf(input: { locale: OwnerLocale }): DocsLanguage {
  return LANGUAGES_BY_LOCALE[input.locale];
}

export function pagePathOf(input: { language: DocsLanguage | null; referralCode: string | null }): string {
  const parameters = new URLSearchParams();
  if (input.language !== null) parameters.set(SITE_LANGUAGE_PARAMETER, input.language);
  if (input.referralCode !== null) parameters.set(SITE_REFERRAL_PARAMETER, input.referralCode);
  const query = parameters.toString();
  return query === '' ? SitePath.Home : `${SitePath.Home}?${query}`;
}

export function canonicalUrlOf(input: { origin: string; locale: OwnerLocale }): string {
  return `${input.origin}${pagePathOf({ language: languageOf({ locale: input.locale }), referralCode: null })}`;
}
