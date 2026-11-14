import type { OwnerLocale } from '@zapbip/types';
import { sha256Hex } from '../adapters/platform/hash';
import { EMAIL_REPLY_TO, EMAIL_SENDER, WELCOME_IDEMPOTENCY_PREFIX } from './email-constants';
import { EmailKind, type EmailMessage } from './email-sender';
import { EmailSlot, filledHtmlOf, filledTextOf } from './email-slot';
import { WELCOME_EMAILS } from './generated/email-templates';

export type WelcomeEmailInput = { locale: OwnerLocale; email: string; referralLink: string };

export async function welcomeMessageOf(input: WelcomeEmailInput): Promise<EmailMessage> {
  const template = WELCOME_EMAILS[input.locale];
  const values = { [EmailSlot.Email]: input.email, [EmailSlot.ReferralLink]: input.referralLink };
  return {
    kind: EmailKind.Welcome,
    from: EMAIL_SENDER,
    to: input.email,
    replyTo: EMAIL_REPLY_TO,
    subject: template.subject,
    html: filledHtmlOf({ html: template.html, values }),
    text: filledTextOf({ text: template.text, values }),
    idempotencyKey: `${WELCOME_IDEMPOTENCY_PREFIX}${await sha256Hex({ value: input.email })}`,
  };
}
