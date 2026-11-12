import { OwnerLocale } from '@zapbip/types';
import { leadingAgentNames } from '../../src/site/site-agents';
import { SiteCopyKey } from '../../src/site/site-copy';
import { expect, test } from './fixtures';
import { siteCopy } from './support/site-copy';

const REFERRAL_CODE = 'abcdefgh2345';
const BROWSER_VIEWPORT_HEIGHT_CLEARANCE = 0;

async function expectFirstFold(input: { page: import('@playwright/test').Page; locale: OwnerLocale }) {
  const { page, locale } = input;
  const copy = (key: SiteCopyKey): string => siteCopy({ key, locale });
  await expect(page.getByRole('heading', { level: 1 })).toContainText(copy(SiteCopyKey.HeroTitleLead));
  await expect(page.getByText(siteCopy({ key: SiteCopyKey.HeroLead, locale, values: { agents: leadingAgentNames() } }))).toBeVisible();
  await expect(page.getByLabel(copy(SiteCopyKey.JoinEmailLabel))).toBeVisible();
  await expect(page.getByRole('button', { name: copy(SiteCopyKey.JoinSubmit) })).toBeVisible();
  const viewportHeight = page.viewportSize()!.height;
  const poster = page.locator('.demo-poster');
  await expect(poster).toBeVisible();
  const box = (await poster.boundingBox())!;
  expect(box.y).toBeLessThan(viewportHeight + BROWSER_VIEWPORT_HEIGHT_CLEARANCE);
}

test('above the fold in en_US', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expectFirstFold({ page, locale: OwnerLocale.EnglishUs });
});

test.describe('pt-BR browser', () => {
  test.use({ locale: 'pt-BR' });

  test('above the fold in pt_BR', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expectFirstFold({ page, locale: OwnerLocale.PortugueseBrazil });
  });
});

test('the switcher changes the language and keeps the referral code', async ({ page }) => {
  await page.goto(`/?ref=${REFERRAL_CODE}`);
  await page.getByRole('button', { name: siteCopy({ key: SiteCopyKey.LocalePortuguese }) }).click();
  await expect(page).toHaveURL(new RegExp(`ref=${REFERRAL_CODE}$`));
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  await expect(page.locator('input[name="referralCode"]')).toHaveValue(REFERRAL_CODE);
});
