import type { EmailSender } from '../../emails/email-sender';

export function createResendEmailSender(_input: { apiKey: string; fetchImplementation: typeof fetch }): EmailSender {
  throw new Error('createResendEmailSender is not implemented');
}
