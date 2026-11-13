import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { OwnerLocale } from '@zapbip/types';
import { ACCEPT_LANGUAGE_HEADER } from '../backoffice/backoffice-constants';
import { resolveTheme } from '../backoffice/backoffice-theme';
import { resolveLocale } from '../backoffice/locale';
import { startLinkLocaleOf } from '../routes/start-link-language';
import type { InstallClient } from '@zapbip/agents/install';
import { isReferralCode } from './referral-code';
import { SiteStartTab, siteAgentIdOf, siteAgents } from './site-agents';
import {
  LOCALE_COOKIE_NAME,
  SITE_AGENT_PARAMETER,
  SITE_LANGUAGE_PARAMETER,
  SITE_REFERRAL_PARAMETER,
  THEME_COOKIE_NAME,
} from './site-constants';
import type { SiteEnv } from './site-env';

function localeOf(input: { context: Context<SiteEnv> }): OwnerLocale {
  const { context } = input;
  const languages = context.req.queries(SITE_LANGUAGE_PARAMETER);
  const queryLocale = languages === undefined ? null : startLinkLocaleOf({ values: languages });
  if (queryLocale !== null) return queryLocale;
  return resolveLocale({ cookieValue: getCookie(context, LOCALE_COOKIE_NAME), acceptLanguage: context.req.header(ACCEPT_LANGUAGE_HEADER) });
}

function referralCodeOf(input: { context: Context<SiteEnv> }): string | null {
  const code = input.context.req.query(SITE_REFERRAL_PARAMETER);
  return code !== undefined && isReferralCode({ value: code }) ? code : null;
}

function agentOf(input: { context: Context<SiteEnv> }): InstallClient | null {
  return siteAgentIdOf({ value: input.context.req.query(SITE_AGENT_PARAMETER) });
}

function startTabOf(input: { context: Context<SiteEnv> }): InstallClient | SiteStartTab {
  const value = input.context.req.query(SITE_AGENT_PARAMETER);
  if (value === SiteStartTab.AnyMcp) return SiteStartTab.AnyMcp;
  const agent = siteAgentIdOf({ value });
  if (agent === null) return siteAgents()[0]!.id;
  return agent;
}

export async function siteContext(context: Context<SiteEnv>, next: Next): Promise<void> {
  context.set('locale', localeOf({ context }));
  context.set('theme', resolveTheme({ cookieValue: getCookie(context, THEME_COOKIE_NAME) }));
  context.set('referralCode', referralCodeOf({ context }));
  context.set('agent', agentOf({ context }));
  context.set('startTab', startTabOf({ context }));
  await next();
}
