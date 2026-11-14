import { reset } from 'cloudflare:test';
import { DAY_MS, HOUR_MS, OwnerLocale, WaitlistSource } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFakeEmailSender } from '../../src/adapters/fake/fake-email-sender';
import { EmailKind, type EmailSender, EmailSendOutcome } from '../../src/emails/email-sender';
import { readSubscriberDigestFacts } from '../../src/operations/subscriber-digest-queries';
import { runSubscriberDigest } from '../../src/operations/subscriber-digest';
import { applyLandingWaitlistMigration } from '../support/seed';
import { seedWaitlistRow } from '../support/waitlist';
import { testEnv } from '../support/workers-env';

const NOW = Date.UTC(2026, 10, 14, 11);
const SINCE = NOW - DAY_MS;
const INSIDE = NOW - HOUR_MS;
const EARLIER_INSIDE = NOW - 2 * HOUR_MS;
const OUTSIDE = NOW - 2 * DAY_MS;

async function stampWelcome(input: { email: string; sentAt: number | null; failedAt: number | null }): Promise<void> {
  await testEnv.CONNECTIONS.prepare('UPDATE landing_waitlist SET welcome_sent_at = ?, welcome_failed_at = ? WHERE email = ?')
    .bind(input.sentAt, input.failedAt, input.email)
    .run();
}

async function seedBusyDay(): Promise<void> {
  await seedWaitlistRow({
    email: 'ana@example.com',
    referralCode: 'anaanaanaana',
    locale: OwnerLocale.PortugueseBrazil,
    createdAt: OUTSIDE,
  });
  await seedWaitlistRow({
    email: 'maria@example.com',
    referralCode: 'mariamariama',
    referredBy: 'anaanaanaana',
    locale: OwnerLocale.PortugueseBrazil,
    createdAt: EARLIER_INSIDE,
  });
  await seedWaitlistRow({
    email: 'joao@example.com',
    referralCode: 'joaojoaojoao',
    referredBy: 'anaanaanaana',
    locale: OwnerLocale.PortugueseBrazil,
    createdAt: INSIDE,
  });
  await seedWaitlistRow({
    email: 'kenji@example.com',
    referralCode: 'kenjikenjike',
    source: WaitlistSource.Agent,
    locale: OwnerLocale.Japanese,
    createdAt: INSIDE,
  });
  await stampWelcome({ email: 'maria@example.com', sentAt: EARLIER_INSIDE, failedAt: null });
  await stampWelcome({ email: 'joao@example.com', sentAt: null, failedAt: INSIDE });
  await stampWelcome({ email: 'ana@example.com', sentAt: OUTSIDE, failedAt: null });
}

function facts() {
  return readSubscriberDigestFacts({ database: testEnv.CONNECTIONS, since: SINCE, until: NOW });
}

beforeEach(applyLandingWaitlistMigration);
afterEach(reset);

describe('the subscriber digest facts', () => {
  it('lists only the subscribers of the last 24 hours, oldest first, with their referrer', async () => {
    await seedBusyDay();
    expect((await facts()).newSubscribers.map((subscriber) => [subscriber.email, subscriber.referrerEmail, subscriber.source])).toEqual([
      ['maria@example.com', 'ana@example.com', WaitlistSource.Form],
      ['joao@example.com', 'ana@example.com', WaitlistSource.Form],
      ['kenji@example.com', null, WaitlistSource.Agent],
    ]);
  });

  it('counts the new subscribers and the whole list', async () => {
    await seedBusyDay();
    expect(await facts()).toMatchObject({ newCount: 3, total: 4 });
  });

  it('totals the whole list by language, largest first', async () => {
    await seedBusyDay();
    expect((await facts()).localeTotals).toEqual([
      { locale: OwnerLocale.PortugueseBrazil, total: 3 },
      { locale: OwnerLocale.Japanese, total: 1 },
    ]);
  });

  it('counts the welcomes sent and failed in the last 24 hours only', async () => {
    await seedBusyDay();
    expect(await facts()).toMatchObject({ welcomesSent: 1, welcomesFailed: 1 });
  });

  it('ranks the referrers of the last 24 hours', async () => {
    await seedBusyDay();
    expect((await facts()).topReferrers).toEqual([{ email: 'ana@example.com', total: 2 }]);
  });

  it('answers zeros and empty lists on an empty waitlist', async () => {
    expect(await facts()).toEqual({
      newCount: 0,
      newSubscribers: [],
      total: 0,
      localeTotals: [],
      welcomesSent: 0,
      welcomesFailed: 0,
      topReferrers: [],
    });
  });
});

describe('the subscriber digest job', () => {
  it('sends one digest to the support address', async () => {
    await seedBusyDay();
    const sender = createFakeEmailSender();
    await runSubscriberDigest({ database: testEnv.CONNECTIONS, sender, now: NOW });
    expect(sender.sentMessages().map((message) => [message.kind, message.to, message.subject])).toEqual([
      [EmailKind.SubscriberDigest, 'support@zapbip.com', 'zapbip · 3 novos inscritos (14/11)'],
    ]);
  });

  it('sends the digest on an empty day too', async () => {
    const sender = createFakeEmailSender();
    await runSubscriberDigest({ database: testEnv.CONNECTIONS, sender, now: NOW });
    expect(sender.sentMessages().map((message) => message.subject)).toEqual(['zapbip · 0 novos inscritos (14/11)']);
  });

  it('fails the tick when the digest could not be sent', async () => {
    const sender: EmailSender = { send: async () => EmailSendOutcome.Failed };
    await expect(runSubscriberDigest({ database: testEnv.CONNECTIONS, sender, now: NOW })).rejects.toThrow('2026-11-14');
  });

  it('passes the tick while delivery is disabled', async () => {
    const sender: EmailSender = { send: async () => EmailSendOutcome.Disabled };
    await expect(runSubscriberDigest({ database: testEnv.CONNECTIONS, sender, now: NOW })).resolves.toBeUndefined();
  });
});
