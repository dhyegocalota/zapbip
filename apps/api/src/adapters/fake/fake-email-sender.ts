import { type EmailMessage, type EmailSender, EmailSendOutcome } from '../../emails/email-sender';

export type FakeEmailSender = EmailSender & { sentMessages(): EmailMessage[] };

export function createFakeEmailSender(): FakeEmailSender {
  const sent: EmailMessage[] = [];
  return {
    async send(message) {
      sent.push(message);
      return EmailSendOutcome.Sent;
    },
    sentMessages() {
      return [...sent];
    },
  };
}
