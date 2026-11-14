import { afterEach, describe, expect, it, vi } from 'vitest';
import { createResendEmailSender } from '../../src/adapters/email/resend-email-sender';
import { LogEvent } from '../../src/contract/log';
import { EmailKind, type EmailMessage, EmailSendOutcome } from '../../src/emails/email-sender';
import { captureLogLines } from '../support/capture-log-lines';

const API_KEY = 're_test_key';
const RESEND_URL = 'https://api.resend.com/emails';
const SERVER_ERROR_STATUS = 500;
const MESSAGE: EmailMessage = {
  kind: EmailKind.Welcome,
  from: 'zapbip <hello@zapbip.com>',
  to: 'maria@example.com',
  replyTo: 'support@zapbip.com',
  subject: 'Welcome to zapbip',
  html: '<p>Welcome</p>',
  text: 'Welcome',
  idempotencyKey: 'welcome-abc',
};

function respondingWith(input: { status: number }): typeof fetch {
  return vi.fn(async () => new Response('{"id":"email-id"}', { status: input.status })) as unknown as typeof fetch;
}

function requestOf(input: { fetchImplementation: typeof fetch }): { url: string; init: RequestInit } {
  const [url, init] = vi.mocked(input.fetchImplementation).mock.calls[0]!;
  return { url: String(url), init: init as RequestInit };
}

afterEach(() => vi.restoreAllMocks());

describe('the Resend email sender', () => {
  it('calls fetch without a receiver, as workerd requires', async () => {
    const fetchImplementation = vi.fn(function (this: unknown) {
      if (this !== undefined) throw new TypeError('Illegal invocation: function called with incorrect `this` reference');
      return Promise.resolve(new Response('{"id":"email-id"}'));
    }) as unknown as typeof fetch;
    await expect(createResendEmailSender({ apiKey: API_KEY, fetchImplementation }).send(MESSAGE)).resolves.toBe(EmailSendOutcome.Sent);
  });

  it('posts the message to the Resend emails endpoint', async () => {
    const fetchImplementation = respondingWith({ status: 200 });
    await createResendEmailSender({ apiKey: API_KEY, fetchImplementation }).send(MESSAGE);
    const { url, init } = requestOf({ fetchImplementation });
    expect(url).toBe(RESEND_URL);
    expect(init.method).toBe('POST');
  });

  it('authenticates with the key as a bearer token', async () => {
    const fetchImplementation = respondingWith({ status: 200 });
    await createResendEmailSender({ apiKey: API_KEY, fetchImplementation }).send(MESSAGE);
    expect(new Headers(requestOf({ fetchImplementation }).init.headers).get('Authorization')).toBe(`Bearer ${API_KEY}`);
  });

  it('sends the idempotency key of the message as a header', async () => {
    const fetchImplementation = respondingWith({ status: 200 });
    await createResendEmailSender({ apiKey: API_KEY, fetchImplementation }).send(MESSAGE);
    expect(new Headers(requestOf({ fetchImplementation }).init.headers).get('Idempotency-Key')).toBe(MESSAGE.idempotencyKey);
  });

  it('sends a JSON body with the sender, the recipient, the reply-to, the subject, the html and the text', async () => {
    const fetchImplementation = respondingWith({ status: 200 });
    await createResendEmailSender({ apiKey: API_KEY, fetchImplementation }).send(MESSAGE);
    const { init } = requestOf({ fetchImplementation });
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({
      from: MESSAGE.from,
      to: [MESSAGE.to],
      reply_to: MESSAGE.replyTo,
      subject: MESSAGE.subject,
      html: MESSAGE.html,
      text: MESSAGE.text,
    });
  });

  it('bounds the request with a timeout signal', async () => {
    const fetchImplementation = respondingWith({ status: 200 });
    await createResendEmailSender({ apiKey: API_KEY, fetchImplementation }).send(MESSAGE);
    expect(requestOf({ fetchImplementation }).init.signal).toBeInstanceOf(AbortSignal);
  });

  it('answers Sent when Resend accepts the message', async () => {
    const outcome = await createResendEmailSender({ apiKey: API_KEY, fetchImplementation: respondingWith({ status: 200 }) }).send(MESSAGE);
    expect(outcome).toBe(EmailSendOutcome.Sent);
  });

  it('answers Failed and logs the kind and the status when Resend refuses the message', async () => {
    const lines = captureLogLines();
    const fetchImplementation = respondingWith({ status: SERVER_ERROR_STATUS });
    const outcome = await createResendEmailSender({ apiKey: API_KEY, fetchImplementation }).send(MESSAGE);
    expect(outcome).toBe(EmailSendOutcome.Failed);
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      { event: LogEvent.EmailSendFailed, kind: EmailKind.Welcome, statusCode: SERVER_ERROR_STATUS },
    ]);
  });

  it('answers Failed with no status when Resend cannot be reached', async () => {
    const lines = captureLogLines();
    const fetchImplementation = vi.fn(async () => {
      throw new TypeError('network down');
    }) as unknown as typeof fetch;
    const outcome = await createResendEmailSender({ apiKey: API_KEY, fetchImplementation }).send(MESSAGE);
    expect(outcome).toBe(EmailSendOutcome.Failed);
    expect(lines.map((line) => JSON.parse(line))).toEqual([{ event: LogEvent.EmailSendFailed, kind: EmailKind.Welcome, statusCode: null }]);
  });

  it('never logs the address, the subject or the key', async () => {
    const lines = captureLogLines();
    await createResendEmailSender({ apiKey: API_KEY, fetchImplementation: respondingWith({ status: SERVER_ERROR_STATUS }) }).send(MESSAGE);
    expect(lines.filter((line) => [MESSAGE.to, MESSAGE.subject, API_KEY].some((secret) => line.includes(secret)))).toEqual([]);
  });
});
