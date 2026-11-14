import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it, vi } from 'vitest';
import { welcomeMessageOf } from '../../src/emails/welcome-email';
import { WELCOME_EMAILS } from '../../src/emails/generated/email-templates';

const EMAIL = 'maria@example.com';
const REFERRAL_LINK = 'https://zapbip.com/?ref=abcdefgh2345';

function refusedPackage(input: { name: string }): never {
  throw new Error(`${input.name} was loaded while sending a welcome`);
}

vi.mock('react', () => refusedPackage({ name: 'react' }));
vi.mock('react-dom/server', () => refusedPackage({ name: 'react-dom/server' }));
vi.mock('@react-email/render', () => refusedPackage({ name: '@react-email/render' }));
vi.mock('@react-email/components', () => refusedPackage({ name: '@react-email/components' }));

describe('sending a welcome', () => {
  it.each(Object.values(OwnerLocale))('only fills the generated %s template', async (locale) => {
    const message = await welcomeMessageOf({ locale, email: EMAIL, referralLink: REFERRAL_LINK });
    const template = WELCOME_EMAILS[locale];
    expect(message.subject).toBe(template.subject);
    expect(message.html).toBe(template.html.replaceAll('{{email}}', EMAIL).replaceAll('{{referralLink}}', REFERRAL_LINK));
    expect(message.text).toBe(template.text.replaceAll('{{email}}', EMAIL).replaceAll('{{referralLink}}', REFERRAL_LINK));
  });
});
