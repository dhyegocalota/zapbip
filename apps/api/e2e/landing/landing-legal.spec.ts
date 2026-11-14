import { WebLocale } from '@zapbip/types';
import { ShellCopyKey } from '../../src/web-shell/shell-copy';
import { expect, test } from './fixtures';
import { shellCopy } from './support/site-copy';

const SCROLL_WIDTH_SCRIPT = 'document.documentElement.scrollWidth';
const VIEWPORT_WIDTH_SCRIPT = 'document.documentElement.clientWidth';
const LEGAL_TWINS = [
  ['/terms', '/pt-br/termos', WebLocale.PortugueseBrazil],
  ['/privacy', '/pt-br/privacidade', WebLocale.PortugueseBrazil],
  ['/pt-br/termos', '/terms', WebLocale.EnglishUs],
  ['/pt-br/privacidade', '/privacy', WebLocale.EnglishUs],
] as const;

for (const [path, twin, locale] of LEGAL_TWINS) {
  test(`${path} reads with no horizontal scroll and its language menu leads to ${twin}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    expect(await page.evaluate(SCROLL_WIDTH_SCRIPT)).toBeLessThanOrEqual((await page.evaluate(VIEWPORT_WIDTH_SCRIPT)) as number);
    await page.locator('.lang-trigger').click();
    await page.locator(`.lang-option[value="${locale}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${twin}$`));
    await expect(page.locator('main h1')).toBeVisible();
  });
}

test('the footer of the home page leads to the privacy policy', async ({ page }) => {
  await page.goto('/');
  await page
    .locator('.footer-links')
    .getByRole('link', { name: shellCopy({ key: ShellCopyKey.FooterPrivacy, locale: WebLocale.EnglishUs }) })
    .click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.locator('main h1')).toBeVisible();
});
