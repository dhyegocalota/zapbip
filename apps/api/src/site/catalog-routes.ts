import {
  COMPANY,
  HttpStatus,
  type WebLocale,
  PRICING_CURRENCY_BY_LOCALE,
  PRICING_FREE_CENTS,
  PRICING_FREE_MESSAGES,
  PRICING_OVERAGE_BLOCK_MESSAGES,
  PRICING_PRO_INCLUDED_MESSAGES,
} from '@zapbip/types';
import type { Context } from 'hono';
import { AgentAnswerStatus, answerResponse, jsonResponse, requestedLocaleOf } from './agentic-answer';
import { formatPrice, pricingValuesOf } from './price-format';
import { FREE_FEATURE_KEYS } from './pricing-features';
import { quickStartEntriesOf } from './quick-start-entries';
import { PAGE_CACHE_CONTROL, PAGE_VARY, SITE_AGENT_PARAMETER } from './site-constants';
import { SiteCopyKey } from './site-copy';
import { copyOf } from './site-copy-text';
import type { SiteEnv } from './site-env';
import { languageOf } from '../web-shell/locale-profiles';
import { SitePath } from './site-paths';

const LANGUAGE_PARAMETER = 'language';
const CATALOG_HEADERS = { 'Cache-Control': PAGE_CACHE_CONTROL, Vary: PAGE_VARY };

function pricingOf(input: { locale: WebLocale; origin: string }): object {
  const { locale, origin } = input;
  const translate = copyOf({ locale });
  const values = pricingValuesOf({ locale });
  const currency = PRICING_CURRENCY_BY_LOCALE[locale];
  return {
    language: languageOf({ locale }),
    currency: currency.toUpperCase(),
    free: {
      name: translate(SiteCopyKey.PricingFreeName),
      messages: PRICING_FREE_MESSAGES,
      price: formatPrice({ cents: PRICING_FREE_CENTS, currency, locale }),
      includes: FREE_FEATURE_KEYS.map((key) => translate(key)),
    },
    pro: {
      name: translate(SiteCopyKey.PricingProName),
      price: values.price,
      period: translate(SiteCopyKey.PricingProPeriod),
      includedMessages: PRICING_PRO_INCLUDED_MESSAGES,
      overagePrice: values.overage,
      overageBlockMessages: PRICING_OVERAGE_BLOCK_MESSAGES,
      includes: [translate(SiteCopyKey.PricingProIncluded, values), translate(SiteCopyKey.PricingProOverage, values)],
    },
    billing: translate(SiteCopyKey.PricingBilling),
    messageDefinition: translate(SiteCopyKey.PricingMessageDefinition),
    requestAccess: `${origin}${SitePath.RequestAccess}`,
    contact: COMPANY.contactEmail,
  };
}

export function pricingHandler(context: Context<SiteEnv>): Response {
  const locale = requestedLocaleOf({ context, value: context.req.query(LANGUAGE_PARAMETER) });
  if (locale === null) return answerResponse({ context, status: AgentAnswerStatus.UnsupportedLanguage, locale: context.get('locale') });
  return jsonResponse({
    context,
    body: pricingOf({ locale, origin: context.env.SITE_ORIGIN }),
    status: HttpStatus.Ok,
    headers: CATALOG_HEADERS,
  });
}

export function quickStartHandler(context: Context<SiteEnv>): Response {
  const locale = requestedLocaleOf({ context, value: context.req.query(LANGUAGE_PARAMETER) });
  if (locale === null) return answerResponse({ context, status: AgentAnswerStatus.UnsupportedLanguage, locale: context.get('locale') });
  const entries = quickStartEntriesOf({ locale });
  const requested = context.req.query(SITE_AGENT_PARAMETER);
  const entry = entries.find((candidate) => candidate.id === requested);
  if (entry === undefined)
    return answerResponse({
      context,
      status: AgentAnswerStatus.UnknownAgent,
      locale,
      extra: { agents: entries.map((candidate) => candidate.id) },
    });
  const translate = copyOf({ locale });
  return jsonResponse({
    context,
    status: HttpStatus.Ok,
    headers: CATALOG_HEADERS,
    body: {
      language: languageOf({ locale }),
      agent: entry.id,
      name: entry.name,
      hint: entry.hint,
      path: entry.path,
      code: entry.code,
      isExample: true,
      caption: translate(SiteCopyKey.StartExampleCaption),
      requestAccess: `${context.env.SITE_ORIGIN}${SitePath.RequestAccess}`,
    },
  });
}
