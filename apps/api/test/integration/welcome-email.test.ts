import { createExecutionContext, reset, waitOnExecutionContext } from 'cloudflare:test';
import { OwnerLocale } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFakeEmailSender } from '../../src/adapters/fake/fake-email-sender';
import { EmailKind, type EmailMessage, type EmailSender, EmailSendOutcome } from '../../src/emails/email-sender';
import { renderWelcomeEmailCopy, WelcomeEmailCopyKey } from '../../src/emails/welcome-email-copy';
import { captureLogLines } from '../support/capture-log-lines';
import { applyLandingWaitlistMigration } from '../support/seed';
import { joinForm, refusingTurnstile, siteFetch } from '../support/site';
import { testEnv } from '../support/workers-env';

const MARIA = 'maria@example.com';
const JSON_HEADERS = { 'content-type': 'application/json' };

type WelcomeColumns = { welcome_sent_at: number | null; welcome_failed_at: number | null };

async function welcomeColumnsOf(input: { email: string }): Promise<WelcomeColumns> {
  const row = await testEnv.CONNECTIONS.prepare('SELECT welcome_sent_at, welcome_failed_at FROM landing_waitlist WHERE email = ?')
    .bind(input.email)
    .first<WelcomeColumns>();
  if (row === null) throw new Error(`no waitlist row for ${input.email}`);
  return row;
}

async function joinSettled(input: { email: string; locale?: OwnerLocale; emailSender: EmailSender }): Promise<Response> {
  const executionContext = createExecutionContext();
  const response = await siteFetch({
    path: '/join',
    method: 'POST',
    form: joinForm({ email: input.email, locale: input.locale }),
    emailSender: input.emailSender,
    executionContext,
  });
  await waitOnExecutionContext(executionContext);
  return response;
}

function senderAnswering(input: { outcome: EmailSendOutcome }): EmailSender & { attempts: EmailMessage[] } {
  const attempts: EmailMessage[] = [];
  return {
    attempts,
    async send(message) {
      attempts.push(message);
      return input.outcome;
    },
  };
}

function subjectOf(input: { locale: OwnerLocale }): string {
  return renderWelcomeEmailCopy({ key: WelcomeEmailCopyKey.Subject, locale: input.locale });
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('the welcome after a site join', () => {
  it('sends one welcome to the joined address in the language of the page', async () => {
    const emailSender = createFakeEmailSender();
    await joinSettled({ email: ' Maria@Example.com', locale: OwnerLocale.PortugueseBrazil, emailSender });
    expect(emailSender.sentMessages().map((message) => [message.kind, message.to, message.subject])).toEqual([
      [EmailKind.Welcome, MARIA, subjectOf({ locale: OwnerLocale.PortugueseBrazil })],
    ]);
  });

  it('stamps the time the welcome was sent', async () => {
    await joinSettled({ email: MARIA, emailSender: createFakeEmailSender() });
    expect((await welcomeColumnsOf({ email: MARIA })).welcome_sent_at).toEqual(expect.any(Number));
  });

  it('never sends a second welcome when the same address joins again', async () => {
    const emailSender = createFakeEmailSender();
    await joinSettled({ email: MARIA, emailSender });
    await joinSettled({ email: MARIA, emailSender });
    expect(emailSender.sentMessages()).toHaveLength(1);
  });

  it('sends nothing when the captcha refuses the join', async () => {
    const emailSender = createFakeEmailSender();
    const executionContext = createExecutionContext();
    await siteFetch({
      path: '/join',
      method: 'POST',
      form: joinForm({ email: MARIA }),
      recording: refusingTurnstile(),
      emailSender,
      executionContext,
    });
    await waitOnExecutionContext(executionContext);
    expect(emailSender.sentMessages()).toEqual([]);
  });

  it('answers the join before the welcome is sent', async () => {
    const release: { send: () => void } = { send: () => undefined };
    const attempts: EmailMessage[] = [];
    const emailSender: EmailSender = {
      send(message) {
        attempts.push(message);
        return new Promise((resolve) => {
          release.send = () => resolve(EmailSendOutcome.Sent);
        });
      },
    };
    const executionContext = createExecutionContext();
    const response = await siteFetch({ path: '/join', method: 'POST', form: joinForm({ email: MARIA }), emailSender, executionContext });
    expect(response.status).toBe(200);
    expect((await welcomeColumnsOf({ email: MARIA })).welcome_failed_at).toBeNull();
    await expect.poll(() => attempts.length).toBe(1);
    release.send();
    await waitOnExecutionContext(executionContext);
    expect((await welcomeColumnsOf({ email: MARIA })).welcome_sent_at).toEqual(expect.any(Number));
  });

  it('still answers 200 and records the failure when the welcome fails', async () => {
    captureLogLines();
    const response = await joinSettled({ email: MARIA, emailSender: senderAnswering({ outcome: EmailSendOutcome.Failed }) });
    expect(response.status).toBe(200);
    expect(await welcomeColumnsOf({ email: MARIA })).toEqual({ welcome_sent_at: null, welcome_failed_at: expect.any(Number) });
  });

  it('still answers 200 and records the failure when the sender throws', async () => {
    captureLogLines();
    const emailSender: EmailSender = {
      async send() {
        throw new Error('sender broke');
      },
    };
    const response = await joinSettled({ email: MARIA, emailSender });
    expect(response.status).toBe(200);
    expect(await welcomeColumnsOf({ email: MARIA })).toEqual({ welcome_sent_at: null, welcome_failed_at: expect.any(Number) });
  });

  it('tries the welcome again on the next join after a failure', async () => {
    captureLogLines();
    await joinSettled({ email: MARIA, emailSender: senderAnswering({ outcome: EmailSendOutcome.Failed }) });
    const emailSender = createFakeEmailSender();
    await joinSettled({ email: MARIA, emailSender });
    expect(emailSender.sentMessages()).toHaveLength(1);
  });

  it('stamps nothing while delivery is disabled, so a later join can still welcome', async () => {
    await joinSettled({ email: MARIA, emailSender: senderAnswering({ outcome: EmailSendOutcome.Disabled }) });
    expect(await welcomeColumnsOf({ email: MARIA })).toEqual({ welcome_sent_at: null, welcome_failed_at: null });
    const emailSender = createFakeEmailSender();
    await joinSettled({ email: MARIA, emailSender });
    expect(emailSender.sentMessages()).toHaveLength(1);
  });
});
