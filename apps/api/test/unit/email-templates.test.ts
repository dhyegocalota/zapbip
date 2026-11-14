import { COMPANY, DOCS_LANGUAGE_OF_OWNER_LOCALE, ONBOARDING_SETUP_LINKS, OwnerLocale, START_LINK } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../src/adapters/platform/hash';
import { EmailKind } from '../../src/emails/email-sender';
import { renderWelcomeEmailCopy, WelcomeEmailCopyKey } from '../../src/emails/welcome-email-copy';
import { welcomeMessageOf } from '../../src/emails/welcome-email';
import { LOCALE_PROFILES } from '../../src/web-shell/locale-profiles';

const LOCALES = Object.values(OwnerLocale);
const EMAIL = 'maria@example.com';
const REFERRAL_LINK = 'https://zapbip.com/?ref=abcdefgh2345';
const UNRESOLVED_PLACEHOLDER = /\{\w+\}/;
const REACT_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' };

function escapedHtml(input: { text: string }): string {
  return input.text.replace(/[&<>"']/g, (character) => REACT_ESCAPES[character]!);
}

function copy(input: { key: WelcomeEmailCopyKey; locale: OwnerLocale }): string {
  return renderWelcomeEmailCopy(input);
}

describe('the welcome email', () => {
  it.each(LOCALES)('carries the subject of %s', async (locale) => {
    const message = await welcomeMessageOf({ locale, email: EMAIL, referralLink: null });
    expect(message.subject).toBe(copy({ key: WelcomeEmailCopyKey.Subject, locale }));
  });

  it.each(LOCALES)('shows the heading of %s in the html and the text', async (locale) => {
    const message = await welcomeMessageOf({ locale, email: EMAIL, referralLink: null });
    const heading = copy({ key: WelcomeEmailCopyKey.Heading, locale });
    expect(message.html).toContain(escapedHtml({ text: heading }));
    expect(message.text).toContain(heading);
  });

  it.each(LOCALES)('declares the language and the direction of %s', async (locale) => {
    const { html } = await welcomeMessageOf({ locale, email: EMAIL, referralLink: null });
    const profile = LOCALE_PROFILES[locale];
    expect(html).toContain(`lang="${profile.languageTag}"`);
    expect(html).toContain(`dir="${profile.textDirection}"`);
  });

  it('reads right to left only in Arabic', async () => {
    const rightToLeft = await Promise.all(
      LOCALES.map(async (locale) => [
        locale,
        (await welcomeMessageOf({ locale, email: EMAIL, referralLink: null })).html.includes('dir="rtl"'),
      ]),
    );
    expect(rightToLeft.filter(([, isRightToLeft]) => isRightToLeft).map(([locale]) => locale)).toEqual([OwnerLocale.Arabic]);
  });

  it.each(LOCALES)('leaves no placeholder unresolved in %s', async (locale) => {
    const message = await welcomeMessageOf({ locale, email: EMAIL, referralLink: REFERRAL_LINK });
    expect(message.html).not.toMatch(UNRESOLVED_PLACEHOLDER);
    expect(message.text).not.toMatch(UNRESOLVED_PLACEHOLDER);
  });

  it.each(LOCALES)('links the start link and the docs of %s', async (locale) => {
    const { text } = await welcomeMessageOf({ locale, email: EMAIL, referralLink: null });
    expect(text).toContain(`${START_LINK}?lang=${DOCS_LANGUAGE_OF_OWNER_LOCALE[locale]}`);
    expect(text).toContain(ONBOARDING_SETUP_LINKS[locale]);
  });

  it('names the company and the address it was sent to in the footer', async () => {
    const { text } = await welcomeMessageOf({ locale: OwnerLocale.EnglishUs, email: EMAIL, referralLink: null });
    expect(text).toContain(COMPANY.tradeName);
    expect(text).toContain(EMAIL);
  });

  it('shows the referral link when the join has one', async () => {
    const { text } = await welcomeMessageOf({ locale: OwnerLocale.EnglishUs, email: EMAIL, referralLink: REFERRAL_LINK });
    expect(text).toContain(copy({ key: WelcomeEmailCopyKey.ReferralLead, locale: OwnerLocale.EnglishUs }));
    expect(text).toContain(REFERRAL_LINK);
  });

  it('leaves the referral block out when the join has no link', async () => {
    const { text } = await welcomeMessageOf({ locale: OwnerLocale.EnglishUs, email: EMAIL, referralLink: null });
    expect(text).not.toContain(copy({ key: WelcomeEmailCopyKey.ReferralLead, locale: OwnerLocale.EnglishUs }));
  });

  it('is sent from hello@zapbip.com to the subscriber with the support address as reply-to', async () => {
    const message = await welcomeMessageOf({ locale: OwnerLocale.EnglishUs, email: EMAIL, referralLink: null });
    expect(message).toMatchObject({ kind: EmailKind.Welcome, from: 'zapbip <hello@zapbip.com>', to: EMAIL, replyTo: 'support@zapbip.com' });
  });

  it('keys the message by a digest of the address, never the address itself', async () => {
    const message = await welcomeMessageOf({ locale: OwnerLocale.EnglishUs, email: EMAIL, referralLink: null });
    expect(message.idempotencyKey).toBe(`welcome-${await sha256Hex({ value: EMAIL })}`);
  });

  it('keeps the brand green and the app icon of the site', async () => {
    const { html } = await welcomeMessageOf({ locale: OwnerLocale.EnglishUs, email: EMAIL, referralLink: null });
    expect(html).toContain('#128C7E');
    expect(html).toContain('https://zapbip.com/site/apple-touch-icon.png');
  });
});
