import { createResendEmailSender } from '../adapters/email/resend-email-sender';
import { createFakeEmailSender } from '../adapters/fake/fake-email-sender';
import { DeployEnvironment } from '../contract/deploy-environment';
import type { Bindings } from '../contract/env';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { EmailDelivery, type EmailSender, EmailSendOutcome } from './email-sender';

type EmailSenderInput = { env: Bindings; fetchImplementation: typeof fetch };

const DISABLED_EMAIL_SENDER: EmailSender = {
  async send(message) {
    logEvent({ event: LogEvent.EmailDisabled, kind: message.kind });
    return EmailSendOutcome.Disabled;
  },
};

function resendApiKeyOf(input: { env: Bindings }): string | null {
  const key = input.env.RESEND_API_KEY;
  if (key === undefined || key.trim() === '') return null;
  return key.trim();
}

function readResendApiKey(input: { env: Bindings }): string {
  const key = resendApiKeyOf(input);
  if (key === null) throw new Error('RESEND_API_KEY is not set');
  return key;
}

const EMAIL_SENDERS: Record<EmailDelivery, (input: EmailSenderInput) => EmailSender> = {
  [EmailDelivery.Resend]: ({ env, fetchImplementation }) =>
    createResendEmailSender({ apiKey: readResendApiKey({ env }), fetchImplementation }),
  [EmailDelivery.Fake]: () => createFakeEmailSender(),
  [EmailDelivery.Disabled]: () => DISABLED_EMAIL_SENDER,
};

export function emailDeliveryOf(input: { env: Bindings }): EmailDelivery {
  if (resendApiKeyOf(input) !== null) return EmailDelivery.Resend;
  if (input.env.ENVIRONMENT === DeployEnvironment.Development) return EmailDelivery.Fake;
  return EmailDelivery.Disabled;
}

export function createEmailSender(input: EmailSenderInput): EmailSender {
  return EMAIL_SENDERS[emailDeliveryOf({ env: input.env })](input);
}
