import { OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { renderWelcomeEmailCopy, WelcomeEmailCopyKey } from '../../src/emails/welcome-email-copy';
import { generatedWelcomeEmailOf } from '../../scripts/emails/welcome-email-template';

describe('the welcome template at build time', () => {
  it('carries the referral lead and the referral slot once sharing opens', async () => {
    const { text } = await generatedWelcomeEmailOf({ locale: OwnerLocale.EnglishUs, isReferralOpen: true });
    expect(text).toContain(renderWelcomeEmailCopy({ key: WelcomeEmailCopyKey.ReferralLead, locale: OwnerLocale.EnglishUs }));
    expect(text).toContain('{{referralLink}}');
  });

  it('leaves an email slot in the footer for the address', async () => {
    const { html, text } = await generatedWelcomeEmailOf({ locale: OwnerLocale.Hindi, isReferralOpen: false });
    expect(html).toContain('{{email}}');
    expect(text).toContain('{{email}}');
  });
});
