import { OwnerLocale, WaitlistSource } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { subscriberDigestMessageOf } from '../../src/emails/subscriber-digest-email';
import { EmailKind } from '../../src/emails/email-sender';
import type { SubscriberDigestFacts } from '../../src/operations/subscriber-digest-queries';

const NOW = Date.UTC(2026, 10, 14, 11);
const JOINED_AT = Date.UTC(2026, 10, 13, 12, 5);
const UNRESOLVED_PLACEHOLDER = /\{\w+\}/;

const QUIET_DAY: SubscriberDigestFacts = {
  newCount: 0,
  newSubscribers: [],
  total: 40,
  localeTotals: [
    { locale: OwnerLocale.PortugueseBrazil, total: 30 },
    { locale: OwnerLocale.EnglishUs, total: 10 },
  ],
  welcomesSent: 0,
  welcomesFailed: 0,
  topReferrers: [],
};

const BUSY_DAY: SubscriberDigestFacts = {
  newCount: 12,
  newSubscribers: [
    {
      email: 'maria@example.com',
      locale: OwnerLocale.PortugueseBrazil,
      source: WaitlistSource.Form,
      referrerEmail: 'ana@example.com',
      joinedAt: JOINED_AT,
    },
    { email: 'kenji@example.com', locale: OwnerLocale.Japanese, source: WaitlistSource.Agent, referrerEmail: null, joinedAt: JOINED_AT },
  ],
  total: 52,
  localeTotals: [
    { locale: OwnerLocale.PortugueseBrazil, total: 41 },
    { locale: OwnerLocale.Japanese, total: 11 },
  ],
  welcomesSent: 11,
  welcomesFailed: 1,
  topReferrers: [{ email: 'ana@example.com', total: 3 }],
};

describe('the subscriber digest on a day with no new subscriber', () => {
  it('says zero in the subject with the day of Brazil', async () => {
    expect((await subscriberDigestMessageOf({ facts: QUIET_DAY, now: NOW })).subject).toBe('zapbip · 0 novos inscritos (14/11)');
  });

  it('says nobody joined', async () => {
    const { text } = await subscriberDigestMessageOf({ facts: QUIET_DAY, now: NOW });
    expect(text).toContain('Nenhum inscrito novo nas últimas 24 horas.');
    expect(text).toContain('Ninguém indicou nas últimas 24 horas.');
  });

  it('still reports the total and the totals by language', async () => {
    const { text } = await subscriberDigestMessageOf({ facts: QUIET_DAY, now: NOW });
    expect(text).toContain('Na lista: 40');
    expect(text).toContain('Português: 30');
    expect(text).toContain('English: 10');
  });
});

describe('the subscriber digest on a busy day', () => {
  it('counts the new subscribers in the subject', async () => {
    expect((await subscriberDigestMessageOf({ facts: BUSY_DAY, now: NOW })).subject).toBe('zapbip · 12 novos inscritos (14/11)');
  });

  it('uses the singular for one new subscriber', async () => {
    const facts = { ...BUSY_DAY, newCount: 1, newSubscribers: BUSY_DAY.newSubscribers.slice(0, 1) };
    expect((await subscriberDigestMessageOf({ facts, now: NOW })).subject).toBe('zapbip · 1 novo inscrito (14/11)');
  });

  it('lists each new address with its language, source, referrer and time in Brazil', async () => {
    const { text } = await subscriberDigestMessageOf({ facts: BUSY_DAY, now: NOW });
    expect(text).toContain('13/11, 09:05 · maria@example.com · Português · formulário · indicado por ana@example.com');
    expect(text).toContain('13/11, 09:05 · kenji@example.com · 日本語 · agente');
  });

  it('says how many more joined than the list shows', async () => {
    const { text } = await subscriberDigestMessageOf({ facts: BUSY_DAY, now: NOW });
    expect(text).toContain('E mais 10 na exportação CSV do backoffice.');
  });

  it('reports the welcome emails sent and failed', async () => {
    const { text } = await subscriberDigestMessageOf({ facts: BUSY_DAY, now: NOW });
    expect(text).toContain('Enviados: 11');
    expect(text).toContain('Com falha: 1');
  });

  it('names the top referrers with their count', async () => {
    const { text } = await subscriberDigestMessageOf({ facts: BUSY_DAY, now: NOW });
    expect(text).toContain('ana@example.com: 3');
  });

  it('leaves no placeholder unresolved', async () => {
    const message = await subscriberDigestMessageOf({ facts: BUSY_DAY, now: NOW });
    expect(message.html).not.toMatch(UNRESOLVED_PLACEHOLDER);
    expect(message.text).not.toMatch(UNRESOLVED_PLACEHOLDER);
  });
});

describe('the subscriber digest message', () => {
  it('goes from hello@zapbip.com to the support address in Portuguese', async () => {
    const message = await subscriberDigestMessageOf({ facts: QUIET_DAY, now: NOW });
    expect(message).toMatchObject({
      kind: EmailKind.SubscriberDigest,
      from: 'zapbip <hello@zapbip.com>',
      to: 'support@zapbip.com',
      replyTo: 'support@zapbip.com',
    });
    expect(message.html).toContain('lang="pt-BR"');
  });

  it('is keyed by its UTC day, so a retried tick never sends it twice', async () => {
    expect((await subscriberDigestMessageOf({ facts: QUIET_DAY, now: NOW })).idempotencyKey).toBe('subscriber-digest-2026-11-14');
  });
});
