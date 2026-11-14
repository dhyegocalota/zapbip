import { LogEvent } from '../../contract/log';
import { EMAIL_SEND_TIMEOUT_MS, RESEND_EMAILS_URL } from '../../emails/email-constants';
import { type EmailKind, type EmailSender, EmailSendOutcome } from '../../emails/email-sender';
import { logEvent } from '../../log';

const AUTHORIZATION_HEADER = 'Authorization';
const CONTENT_TYPE_HEADER = 'Content-Type';
const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';
const BEARER_PREFIX = 'Bearer ';
const JSON_CONTENT_TYPE = 'application/json';

function failedOf(input: { kind: EmailKind; statusCode: number | null }): EmailSendOutcome {
  logEvent({ event: LogEvent.EmailSendFailed, kind: input.kind, statusCode: input.statusCode });
  return EmailSendOutcome.Failed;
}

export function createResendEmailSender(input: { apiKey: string; fetchImplementation: typeof fetch }): EmailSender {
  return {
    async send(message) {
      const response = await input
        .fetchImplementation(RESEND_EMAILS_URL, {
          method: 'POST',
          headers: {
            [AUTHORIZATION_HEADER]: `${BEARER_PREFIX}${input.apiKey}`,
            [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE,
            [IDEMPOTENCY_KEY_HEADER]: message.idempotencyKey,
          },
          body: JSON.stringify({
            from: message.from,
            to: [message.to],
            reply_to: message.replyTo,
            subject: message.subject,
            html: message.html,
            text: message.text,
          }),
          signal: AbortSignal.timeout(EMAIL_SEND_TIMEOUT_MS),
        })
        .catch(() => null);
      if (response === null) return failedOf({ kind: message.kind, statusCode: null });
      if (!response.ok) return failedOf({ kind: message.kind, statusCode: response.status });
      return EmailSendOutcome.Sent;
    },
  };
}
