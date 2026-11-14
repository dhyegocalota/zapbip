import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeEmailSender } from '../../src/adapters/fake/fake-email-sender';
import type { Bindings } from '../../src/contract/env';
import { DeployEnvironment } from '../../src/contract/deploy-environment';
import { LogEvent } from '../../src/contract/log';
import { createEmailSender, emailDeliveryOf } from '../../src/emails/email-delivery';
import { EmailDelivery, EmailKind, type EmailMessage, EmailSendOutcome } from '../../src/emails/email-sender';
import { captureLogLines } from '../support/capture-log-lines';

const API_KEY = 're_test_key';
const MESSAGE: EmailMessage = {
  kind: EmailKind.SubscriberDigest,
  from: 'zapbip <hello@zapbip.com>',
  to: 'support@zapbip.com',
  replyTo: 'support@zapbip.com',
  subject: 'zapbip · 0 novos inscritos (14/11)',
  html: '<p>Nada</p>',
  text: 'Nada',
  idempotencyKey: 'subscriber-digest-2026-11-14',
};

function envOf(input: { environment: DeployEnvironment; apiKey?: string }): Bindings {
  return { ENVIRONMENT: input.environment, RESEND_API_KEY: input.apiKey } as Bindings;
}

function unusedFetch(): typeof fetch {
  return vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
}

afterEach(() => vi.restoreAllMocks());

describe('the email delivery', () => {
  it.each([
    ['production without a key', envOf({ environment: DeployEnvironment.Production }), EmailDelivery.Disabled],
    ['staging with a blank key', envOf({ environment: DeployEnvironment.Staging, apiKey: '  ' }), EmailDelivery.Disabled],
    ['development without a key', envOf({ environment: DeployEnvironment.Development }), EmailDelivery.Fake],
    ['production with a key', envOf({ environment: DeployEnvironment.Production, apiKey: API_KEY }), EmailDelivery.Resend],
    ['development with a key', envOf({ environment: DeployEnvironment.Development, apiKey: API_KEY }), EmailDelivery.Resend],
  ])('is %s', (_name, env, delivery) => {
    expect(emailDeliveryOf({ env })).toBe(delivery);
  });
});

describe('the disabled sender', () => {
  it('answers Disabled and sends nothing', async () => {
    captureLogLines();
    const fetchImplementation = unusedFetch();
    const sender = createEmailSender({ env: envOf({ environment: DeployEnvironment.Production }), fetchImplementation });
    expect(await sender.send(MESSAGE)).toBe(EmailSendOutcome.Disabled);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('reports the skipped message once with its kind', async () => {
    const lines = captureLogLines();
    const sender = createEmailSender({ env: envOf({ environment: DeployEnvironment.Production }), fetchImplementation: unusedFetch() });
    await sender.send(MESSAGE);
    expect(lines.map((line) => JSON.parse(line))).toEqual([{ event: LogEvent.EmailDisabled, kind: EmailKind.SubscriberDigest }]);
  });
});

describe('the Resend delivery', () => {
  it('sends through the fetch it was given with the trimmed key', async () => {
    const fetchImplementation = unusedFetch();
    const env = envOf({ environment: DeployEnvironment.Production, apiKey: ` ${API_KEY} ` });
    expect(await createEmailSender({ env, fetchImplementation }).send(MESSAGE)).toBe(EmailSendOutcome.Sent);
    const [, init] = vi.mocked(fetchImplementation).mock.calls[0]!;
    expect(new Headers((init as RequestInit).headers).get('Authorization')).toBe(`Bearer ${API_KEY}`);
  });
});

describe('the fake sender', () => {
  it('answers Sent in development without a key and never reaches the network', async () => {
    const fetchImplementation = unusedFetch();
    const sender = createEmailSender({ env: envOf({ environment: DeployEnvironment.Development }), fetchImplementation });
    expect(await sender.send(MESSAGE)).toBe(EmailSendOutcome.Sent);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('keeps every message it sent, in order', async () => {
    const sender = createFakeEmailSender();
    await sender.send(MESSAGE);
    await sender.send({ ...MESSAGE, subject: 'second' });
    expect(sender.sentMessages().map((message) => message.subject)).toEqual([MESSAGE.subject, 'second']);
  });
});
