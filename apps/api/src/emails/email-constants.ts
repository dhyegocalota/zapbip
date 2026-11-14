import { COMPANY, PRODUCTION_ZONE, SECOND_MS } from '@zapbip/types';

export const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
export const EMAIL_SEND_TIMEOUT_MS = 10 * SECOND_MS;
export const EMAIL_SENDER = `zapbip <hello@${PRODUCTION_ZONE}>`;
export const EMAIL_REPLY_TO = COMPANY.contactEmail;
export const SUBSCRIBER_DIGEST_RECIPIENT = COMPANY.contactEmail;
