import { DAY_MS, MINUTE_MS, SECOND_MS } from '@zapbip/types';

export const SEE_OTHER_STATUS = 303;
export const RETURN_TO_FIELD = 'returnTo';
export const HSTS_MAX_AGE_SECONDS = 63_072_000;
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "style-src 'self'",
  "img-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');
export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'X-Robots-Tag': 'noindex, nofollow',
};
export const NO_STORE = 'no-store';
export { RETRY_AFTER_HEADER } from '../routes/private-response';
export const NON_ERROR_CODE = 'NonError';
export const SESSION_COOKIE_NAME = '__Host-zb_bo_session';
export const CSRF_COOKIE_NAME = '__Host-zb_bo_csrf';
export const LOCALE_COOKIE_NAME = '__Host-zb_bo_locale';
export const THEME_COOKIE_NAME = '__Host-zb_bo_theme';
export const SESSION_TOKEN_BYTES = 32;
export const CSRF_TOKEN_BYTES = 32;
export const ACCEPT_LANGUAGE_HEADER = 'accept-language';
export const ENGLISH_LANGUAGE_PREFIX = 'en';
export const CSRF_CONTEXT = 'zapbip backoffice csrf';
export const BACKOFFICE_PRUNE_HOUR = 4;
export const BACKOFFICE_PRUNE_MINUTE = 0;
export const PREFERENCE_COOKIE_MAX_AGE_SECONDS = (365 * DAY_MS) / SECOND_MS;
export const FLASH_MAX_AGE_MS = MINUTE_MS;
export const AUDIT_PAGE_LIMIT = 200;
export const STYLESHEET_CACHE_CONTROL = 'public, max-age=31536000, immutable';
export const SPARKLINE_DAYS = 14;
