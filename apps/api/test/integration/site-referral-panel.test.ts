import { DEFAULT_WAITLIST_REFERRAL_CAP, OwnerLocale } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { REFERRAL_SHARING_OPEN } from '../../src/site/site-constants';
import { SiteCopyKey } from '../../src/site/site-copy';
import { ReferralThanksPanel } from '../../src/site/views/referral-thanks-panel';
import { copyHtml, REFERRAL_CODE, SITE_ORIGIN } from '../support/site';

const LOCALE = OwnerLocale.EnglishUs;
const LINK = `${SITE_ORIGIN}/?ref=${REFERRAL_CODE}`;

async function panelOf(input: { creditedCount: number }): Promise<string> {
  const node = ReferralThanksPanel({
    locale: LOCALE,
    siteOrigin: SITE_ORIGIN,
    referralCode: REFERRAL_CODE,
    creditedCount: input.creditedCount,
    cap: DEFAULT_WAITLIST_REFERRAL_CAP,
  });
  return String(await node.toString());
}

describe('the dormant referral panel', () => {
  it('stays closed until the owner opens referrals after launch', () => {
    expect(REFERRAL_SHARING_OPEN).toBe(false);
  });

  it('shows the personal link, the copy button, the WhatsApp share and the count', async () => {
    const html = await panelOf({ creditedCount: 1 });
    expect(html).toContain('id="invite-link"');
    expect(html).toContain(`value="${LINK}"`);
    expect(html).toContain(copyHtml({ key: SiteCopyKey.ThanksCopy, locale: LOCALE }));
    expect(html).toContain('href="https://wa.me/?text=');
    expect(html).toContain(
      copyHtml({ key: SiteCopyKey.ThanksInviteCount, locale: LOCALE, values: { count: '1', cap: String(DEFAULT_WAITLIST_REFERRAL_CAP) } }),
    );
    expect(html).not.toContain(copyHtml({ key: SiteCopyKey.ThanksCapReached, locale: LOCALE }));
  });

  it('says so at the cap', async () => {
    const html = await panelOf({ creditedCount: DEFAULT_WAITLIST_REFERRAL_CAP });
    expect(html).toContain(copyHtml({ key: SiteCopyKey.ThanksCapReached, locale: LOCALE }));
  });
});
