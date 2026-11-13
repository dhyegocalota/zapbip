import { OwnerLocale } from '@zapbip/types';
import { expect, test } from './fixtures';
import { SiteCopyKey } from '../../src/site/site-copy';
import { siteCopy } from './support/site-copy';
import { pricingValuesOf } from '../../src/site/price-format';

const PRO_HEIGHT_RATIO = 0.6;

test('an unknown agent in the address shows no hint', async ({ page }) => {
  await page.goto('/?agent=nope');
  await expect(page.locator('.join-agent')).toBeHidden();
  await expect(page.locator('#join-email')).toBeVisible();
});

test('the pricing offers the free plan and sends its button to the form', async ({ page }) => {
  await page.goto('/');
  const pricing = page.locator('#pricing');
  await expect(pricing.locator('.plan-free .plan-amount')).toHaveText('$0');
  await expect(pricing.locator('.plan-pro .plan-amount')).toHaveText('$9');
  await expect(pricing.locator('.plan-pro')).toContainText(siteCopy({ key: SiteCopyKey.PricingProName }));
  await pricing.getByRole('link', { name: siteCopy({ key: SiteCopyKey.PricingCta }) }).click();
  await expect(page.locator('#join-email')).toBeFocused();
});

test('the free question opens in the FAQ', async ({ page }) => {
  await page.goto('/');
  await page.getByText(siteCopy({ key: SiteCopyKey.FaqFreeQuestion })).click();
  await expect(page.getByText(siteCopy({ key: SiteCopyKey.FaqFreeAnswer, values: pricingValuesOf({ locale: OwnerLocale.EnglishUs }) }))).toBeVisible();
});

test('the Pro card does not stretch to the height of the Free card', async ({ page }) => {
  await page.goto('/');
  const free = (await page.locator('.plan-free').boundingBox())!;
  const pro = (await page.locator('.plan-pro').boundingBox())!;
  expect(pro.height).toBeLessThan(free.height * PRO_HEIGHT_RATIO);
});

test('the decoration of the final call stays inside its rounded corner', async ({ page }) => {
  await page.goto('/');
  const offsets = await page.evaluate(
    `(() => { const style = getComputedStyle(document.querySelector('.final'), '::after'); return [parseFloat(style.top), parseFloat(style.right)]; })()`,
  );
  expect((offsets as number[]).filter((offset) => offset < 0)).toEqual([]);
});
