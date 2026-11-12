import { HSTS_MAX_AGE_SECONDS } from '../backoffice/backoffice-constants';

export const SITE_CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self' https://challenges.cloudflare.com",
  'frame-src https://challenges.cloudflare.com',
  "img-src 'self'",
  "style-src 'self'",
  "media-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');

export const SITE_SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': SITE_CONTENT_SECURITY_POLICY,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};
export const SITE_STRICT_TRANSPORT_SECURITY = `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`;
