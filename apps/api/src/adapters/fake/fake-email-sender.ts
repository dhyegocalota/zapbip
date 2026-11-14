import type { EmailMessage, EmailSender } from '../../emails/email-sender';

export type FakeEmailSender = EmailSender & { sentMessages(): EmailMessage[] };

export function createFakeEmailSender(): FakeEmailSender {
  throw new Error('createFakeEmailSender is not implemented');
}
