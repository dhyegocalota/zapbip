import { DocsLanguage, OwnerLocale } from '@zapbip/types';
import type { InstallClient } from '@zapbip/agents/install';
import { JOIN_FRAGMENT, START_FRAGMENT, SITE_AGENT_PARAMETER, SITE_REFERRAL_PARAMETER } from './site-constants';
import type { SiteStartTab } from './site-agents';
import { legalPathOf, legalUrlOf } from './legal-links';
import type { PageModel } from './page-model';
import { localePathOf } from './site-language';

const LANGUAGES_BY_LOCALE: Record<OwnerLocale, DocsLanguage> = {
  [OwnerLocale.PortugueseBrazil]: DocsLanguage.PortugueseBrazil,
  [OwnerLocale.EnglishUs]: DocsLanguage.English,
};

export function languageOf(input: { locale: OwnerLocale }): DocsLanguage {
  return LANGUAGES_BY_LOCALE[input.locale];
}

export function pagePathOf(input: {
  locale: OwnerLocale;
  agent: InstallClient | SiteStartTab | null;
  referralCode: string | null;
}): string {
  const parameters = new URLSearchParams();
  if (input.agent !== null) parameters.set(SITE_AGENT_PARAMETER, input.agent);
  if (input.referralCode !== null) parameters.set(SITE_REFERRAL_PARAMETER, input.referralCode);
  const path = localePathOf({ locale: input.locale });
  const query = parameters.toString();
  return query === '' ? path : `${path}?${query}`;
}

export function canonicalUrlOf(input: { origin: string; locale: OwnerLocale }): string {
  return `${input.origin}${localePathOf({ locale: input.locale })}`;
}

export function agentPathOf(input: { agent: InstallClient; locale: OwnerLocale; referralCode: string | null }): string {
  return `${pagePathOf({ locale: input.locale, agent: input.agent, referralCode: input.referralCode })}${JOIN_FRAGMENT}`;
}

export function joinPathOf(input: { locale: OwnerLocale; referralCode: string | null }): string {
  return `${pagePathOf({ locale: input.locale, agent: null, referralCode: input.referralCode })}${JOIN_FRAGMENT}`;
}

export function startPathOf(input: { tab: InstallClient | SiteStartTab; locale: OwnerLocale; referralCode: string | null }): string {
  return `${pagePathOf({ locale: input.locale, agent: input.tab, referralCode: input.referralCode })}${START_FRAGMENT}`;
}

export function returnPathOf(input: { model: PageModel }): string {
  const { model } = input;
  if (model.legalDocument !== null) return legalPathOf({ document: model.legalDocument, locale: model.locale });
  return pagePathOf({ locale: model.locale, agent: model.agentParameter, referralCode: model.referralCode });
}

export function pageUrlOf(input: { model: PageModel; locale: OwnerLocale }): string {
  const { model, locale } = input;
  if (model.legalDocument !== null) return legalUrlOf({ origin: model.siteOrigin, document: model.legalDocument, locale });
  return canonicalUrlOf({ origin: model.siteOrigin, locale });
}
