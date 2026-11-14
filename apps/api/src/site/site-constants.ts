import { buildConnectionLink, RATE_LIMIT_PERIOD_MS } from '@zapbip/core';
import { DAY_MS, HOUR_MS, MINUTE_MS, PRODUCTION_PUBLIC_ORIGIN, SECOND_MS } from '@zapbip/types';
import { CONNECTION_SECRET_PREFIX } from '../contract/constants';

const EXAMPLE_SECRET_BODY = 'ex4mPLe7Hq2xVn9Rt4Wm8Ls3Jd6Hf1Yb5Gc0Zk2Ns7q';

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_VERIFY_TIMEOUT_MS = 5 * SECOND_MS;
export const REFERRAL_CODE_BYTE_BATCH = 48;
export const REFERRAL_CODE_ACCEPT_LIMIT = 240;
export const REFERRAL_CODE_CLASH_ATTEMPTS = 3;
export const EMAIL_PATTERN = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
export const SITE_LANGUAGE_PARAMETER = 'lang';
export const SITE_REFERRAL_PARAMETER = 'ref';
export const SITE_AGENT_PARAMETER = 'agent';
export const JOIN_FRAGMENT = '#join';
export const START_FRAGMENT = '#start';
export const THEME_FRAGMENT = '#theme';
export const THEME_SWITCH_ID = 'theme';
export const LOCALE_COOKIE_NAME = '__Host-zb_site_locale';
export const THEME_COOKIE_NAME = '__Host-zb_site_theme';
export const TURNSTILE_RESPONSE_FIELD = 'cf-turnstile-response';
export const TURNSTILE_PASSED_CALLBACK = 'zapbipCheckPassed';
export const TURNSTILE_FAILED_CALLBACK = 'zapbipCheckFailed';
export const TURNSTILE_WAIT_MS = 15 * SECOND_MS;
export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
export const DEMO_IMAGE_SIZE = 960;
export const POSTER_SMALL_WIDTH = 540;
export const OPEN_GRAPH_WIDTH = 1200;
export const OPEN_GRAPH_HEIGHT = 630;
export const POSTER_SIZES = '(min-width: 64rem) 31rem, (min-width: 40rem) 34rem, calc(100vw - 2rem)';
export const INVITE_METER_SEGMENT_LIMIT = 10;
export const INVITE_METER_VIEWBOX_WIDTH = 100;
export const INVITE_METER_VIEWBOX_HEIGHT = 8;
export const INVITE_METER_GAP = 2;
export const RETRY_AFTER_VALUE = String(RATE_LIMIT_PERIOD_MS / SECOND_MS);
export const THEME_COLOR_LIGHT = '#F6F8F5';
export const THEME_COLOR_DARK = '#07120F';
export const SITE_BRAND_SEPARATOR = ' · ';
export const RATE_KEY_PREFIX = 'join:';
export const NO_STORE_CACHE_CONTROL = 'no-store';
export const PAGE_CACHE_CONTROL = 'private, no-cache';
export const PAGE_VARY = 'Accept, Accept-Language, Cookie';
export const STYLESHEET_CONTENT_TYPE = 'text/css; charset=utf-8';
export const SCRIPT_CONTENT_TYPE = 'text/javascript; charset=utf-8';
export const LEGAL_UPDATED_ON = '2026-11-14';
export const SITE_UPDATED_ON = '2026-11-14';
export const REFERRAL_SHARING_OPEN = false;
export const PRICING_FRAGMENT = '#pricing';
export const SITE_EXAMPLE_CONNECTION_LINK = buildConnectionLink({
  publicOrigin: PRODUCTION_PUBLIC_ORIGIN,
  secret: `${CONNECTION_SECRET_PREFIX}${EXAMPLE_SECRET_BODY}`,
});
export const SETUP_CONNECTION_PLACEHOLDER = '<your-connection-link>';
export const SITE_EMAIL_PARAMETER = 'email';
export const SITE_EXAMPLE_EMAIL = 'name@example.com';
export const TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';
export const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8';
export const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
export const REPOSITORY_PATH = 'dhyegocalota/zapbip';
export const REPOSITORY_URL = `https://github.com/${REPOSITORY_PATH}`;
export const REPOSITORY_SELF_HOSTING_URL = `${REPOSITORY_URL}#-self-hosting`;
export const REPOSITORY_API_URL = `https://api.github.com/repos/${REPOSITORY_PATH}`;
export const REPOSITORY_API_ACCEPT = 'application/vnd.github+json';
export const REPOSITORY_USER_AGENT = 'zapbip-site';
export const REPOSITORY_STARS_TIMEOUT_MS = 2 * SECOND_MS;
export const REPOSITORY_STARS_CACHE_MS = HOUR_MS;
export const REPOSITORY_STARS_RETRY_MS = 5 * MINUTE_MS;
export const SOURCE_LICENSE_URL = 'https://www.gnu.org/licenses/agpl-3.0.html';
export const SECURITY_POLICY_URL = `${REPOSITORY_URL}/security/policy`;
export const SECURITY_TEXT_VALIDITY_MS = 180 * DAY_MS;
export const IS_SECURITY_POLICY_PUBLIC = false;
export const AGENT_CRAWLER_NAMES = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'Meta-ExternalAgent',
  'Amazonbot',
  'CCBot',
  'DuckAssistBot',
  'MistralAI-User',
];
