import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import type { InstallClient } from '@zapbip/agents/install';
import type { OwnerLocale } from '@zapbip/types';
import { ACCEPT_LANGUAGE_HEADER } from '../backoffice/backoffice-constants';
import { resolveTheme } from '../backoffice/backoffice-theme';
import { isReferralCode } from './referral-code';
import { agentParameterOf, siteAgentIdOf, siteAgents, type SiteStartTab } from './site-agents';
import { LOCALE_COOKIE_NAME, SITE_AGENT_PARAMETER, SITE_REFERRAL_PARAMETER, THEME_COOKIE_NAME } from './site-constants';
import type { SiteEnv } from './site-env';
import { localeOfPath, preferredLocaleOf } from './site-language';

function localeOf(input: { context: Context<SiteEnv> }): OwnerLocale {
  const { context } = input;
  const pathLocale = localeOfPath({ pathname: new URL(context.req.url).pathname });
  if (pathLocale !== null) return pathLocale;
  return preferredLocaleOf({
    cookieValue: getCookie(context, LOCALE_COOKIE_NAME),
    acceptLanguage: context.req.header(ACCEPT_LANGUAGE_HEADER),
  });
}

function referralCodeOf(input: { context: Context<SiteEnv> }): string | null {
  const code = input.context.req.query(SITE_REFERRAL_PARAMETER);
  return code !== undefined && isReferralCode({ value: code }) ? code : null;
}

function agentOf(input: { context: Context<SiteEnv> }): InstallClient | null {
  return siteAgentIdOf({ value: input.context.req.query(SITE_AGENT_PARAMETER) });
}

function agentParameterFrom(input: { context: Context<SiteEnv> }): InstallClient | SiteStartTab | null {
  return agentParameterOf({ value: input.context.req.query(SITE_AGENT_PARAMETER) });
}

function startTabOf(input: { context: Context<SiteEnv> }): InstallClient | SiteStartTab {
  const parameter = agentParameterFrom(input);
  if (parameter === null) return siteAgents()[0]!.id;
  return parameter;
}

export async function siteContext(context: Context<SiteEnv>, next: Next): Promise<void> {
  context.set('locale', localeOf({ context }));
  context.set('theme', resolveTheme({ cookieValue: getCookie(context, THEME_COOKIE_NAME) }));
  context.set('referralCode', referralCodeOf({ context }));
  context.set('agent', agentOf({ context }));
  context.set('agentParameter', agentParameterFrom({ context }));
  context.set('startTab', startTabOf({ context }));
  await next();
}
