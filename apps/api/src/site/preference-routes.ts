import { WebLocale } from '@zapbip/types';
import { Hono } from 'hono';
import { ShellTheme } from '../web-shell/shell-theme';
import { NO_CONTENT_STATUS, SEE_OTHER_STATUS } from '../backoffice/backoffice-constants';
import { textFieldOf } from '../backoffice/form-fields';
import { setPreferenceCookie } from '../backoffice/preference-cookie';
import { isReferralCode } from './referral-code';
import { agentParameterOf, type SiteStartTab } from './site-agents';
import type { InstallClient } from '@zapbip/agents/install';
import { LOCALE_COOKIE_NAME, SITE_AGENT_PARAMETER, SITE_REFERRAL_PARAMETER, THEME_COOKIE_NAME, THEME_FRAGMENT } from './site-constants';
import { type LegalDocument, legalPageOf, legalPathOf } from './legal-links';
import { localeOfPath } from './site-language';
import { pagePathOf } from './site-links';
import type { SiteEnv } from './site-env';
import { SitePath } from './site-paths';

const LOCALE_FIELD = 'locale';
const THEME_FIELD = 'theme';
const RETURN_TO_FIELD = 'returnTo';
const FETCH_MODE_HEADER = 'Sec-Fetch-Mode';
const NAVIGATE_FETCH_MODE = 'navigate';
const LOCALES: string[] = Object.values(WebLocale);
const THEMES: string[] = Object.values(ShellTheme);
const RETURN_BASE = 'https://return.invalid';

type ReturnTarget = {
  locale: WebLocale;
  agent: InstallClient | SiteStartTab | null;
  referralCode: string | null;
  legalDocument: LegalDocument | null;
};

function returnTargetOf(input: { returnTo: string | null }): ReturnTarget | null {
  const { returnTo } = input;
  if (returnTo === null || !returnTo.startsWith('/') || returnTo.startsWith('//')) return null;
  const url = new URL(returnTo, RETURN_BASE);
  const legalPage = legalPageOf({ pathname: url.pathname });
  if (legalPage !== null) {
    return url.pathname === returnTo
      ? { locale: legalPage.locale, agent: null, referralCode: null, legalDocument: legalPage.document }
      : null;
  }
  const locale = localeOfPath({ pathname: url.pathname });
  const agentValue = url.searchParams.get(SITE_AGENT_PARAMETER);
  const codeValue = url.searchParams.get(SITE_REFERRAL_PARAMETER);
  const agent = agentValue === null ? null : agentParameterOf({ value: agentValue });
  const referralCode = codeValue !== null && isReferralCode({ value: codeValue }) ? codeValue : null;
  const isKnownLocale = locale !== null;
  const isKnownAgent = agentValue === null || agent !== null;
  const isKnownCode = codeValue === null || referralCode !== null;
  const isCanonical = isKnownLocale && isKnownAgent && isKnownCode && pagePathOf({ locale, agent, referralCode }) === returnTo;
  return isCanonical ? { locale, agent, referralCode, legalDocument: null } : null;
}

function targetPathOf(input: { target: ReturnTarget; locale: WebLocale }): string {
  const { target, locale } = input;
  if (target.legalDocument !== null) return legalPathOf({ document: target.legalDocument, locale });
  return pagePathOf({ locale, agent: target.agent, referralCode: target.referralCode });
}

export const preferenceRoutes = new Hono<SiteEnv>();

preferenceRoutes.post(SitePath.Locale, async (context) => {
  const form = await context.req.parseBody();
  const value = textFieldOf({ form, name: LOCALE_FIELD });
  const locale = value !== null && LOCALES.includes(value) ? (value as WebLocale) : null;
  const returnTarget = returnTargetOf({ returnTo: textFieldOf({ form, name: RETURN_TO_FIELD }) });
  if (locale === null) {
    const unchanged = pagePathOf({ locale: context.get('locale'), agent: null, referralCode: null });
    return context.redirect(
      returnTarget === null ? unchanged : targetPathOf({ target: returnTarget, locale: returnTarget.locale }),
      SEE_OTHER_STATUS,
    );
  }
  setPreferenceCookie({ context, name: LOCALE_COOKIE_NAME, value: locale });
  if (returnTarget === null) return context.redirect(pagePathOf({ locale, agent: null, referralCode: null }), SEE_OTHER_STATUS);
  return context.redirect(targetPathOf({ target: returnTarget, locale }), SEE_OTHER_STATUS);
});

preferenceRoutes.post(SitePath.Theme, async (context) => {
  const form = await context.req.parseBody();
  const theme = textFieldOf({ form, name: THEME_FIELD });
  if (theme !== null && THEMES.includes(theme)) setPreferenceCookie({ context, name: THEME_COOKIE_NAME, value: theme });
  const fetchMode = context.req.header(FETCH_MODE_HEADER);
  const isScriptSave = fetchMode !== undefined && fetchMode !== NAVIGATE_FETCH_MODE;
  if (isScriptSave) return context.body(null, NO_CONTENT_STATUS);
  const returnTarget = returnTargetOf({ returnTo: textFieldOf({ form, name: RETURN_TO_FIELD }) });
  const target =
    returnTarget === null
      ? pagePathOf({ locale: context.get('locale'), agent: null, referralCode: null })
      : targetPathOf({ target: returnTarget, locale: returnTarget.locale });
  return context.redirect(`${target}${THEME_FRAGMENT}`, SEE_OTHER_STATUS);
});
