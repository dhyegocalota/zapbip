import { SECOND_MS } from '@zapbip/types';

export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_VERIFY_TIMEOUT_MS = 5 * SECOND_MS;
export const REFERRAL_CODE_BYTE_BATCH = 48;
export const REFERRAL_CODE_ACCEPT_LIMIT = 240;
export const REFERRAL_CODE_CLASH_ATTEMPTS = 3;
export const EMAIL_PATTERN = /^[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
export const SITE_LANGUAGE_PARAMETER = 'lang';
export const SITE_REFERRAL_PARAMETER = 'ref';
export const LOCALE_COOKIE_NAME = '__Host-zb_site_locale';
export const THEME_COOKIE_NAME = '__Host-zb_site_theme';
export const TURNSTILE_RESPONSE_FIELD = 'cf-turnstile-response';
export const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
