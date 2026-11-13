import { HSTS_MAX_AGE_SECONDS, STATIC_SECURITY_HEADERS } from '../backoffice/backoffice-constants';

export const CLIENT_APP_SECURITY_HEADERS: Record<string, string> = {
  ...STATIC_SECURITY_HEADERS,
  'Referrer-Policy': 'no-referrer',
};
export const CLIENT_APP_STRICT_TRANSPORT_SECURITY = `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`;
export const CLIENT_APP_DEFAULT_CACHE_CONTROL = 'no-store';
