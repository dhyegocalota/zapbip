export enum EmailKind {
  Welcome = 'welcome',
  SubscriberDigest = 'subscriber_digest',
}

export enum EmailSendOutcome {
  Sent = 'sent',
  Failed = 'failed',
  Disabled = 'disabled',
}

export enum EmailDelivery {
  Resend = 'resend',
  Fake = 'fake',
  Disabled = 'disabled',
}

export type EmailMessage = {
  kind: EmailKind;
  from: string;
  to: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type EmailSender = {
  send(message: EmailMessage): Promise<EmailSendOutcome>;
};
