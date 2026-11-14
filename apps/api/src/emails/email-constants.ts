import { COMPANY, OwnerLocale, PRODUCTION_ZONE, SECOND_MS } from '@zapbip/types';

export const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
export const EMAIL_SEND_TIMEOUT_MS = 10 * SECOND_MS;
export const EMAIL_BRAND_NAME = 'zapbip';
export const EMAIL_SENDER = `${EMAIL_BRAND_NAME} <hello@${PRODUCTION_ZONE}>`;
export const EMAIL_REPLY_TO = COMPANY.contactEmail;
export const SUBSCRIBER_DIGEST_RECIPIENT = COMPANY.contactEmail;
export const WELCOME_IDEMPOTENCY_PREFIX = 'welcome-';
export const SUBSCRIBER_DIGEST_IDEMPOTENCY_PREFIX = 'subscriber-digest-';
export const OWNER_TIME_ZONE = 'America/Sao_Paulo';
export const SUBSCRIBER_DIGEST_LOCALE = OwnerLocale.PortugueseBrazil;
