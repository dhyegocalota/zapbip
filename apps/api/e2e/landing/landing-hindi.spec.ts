import { OwnerLocale } from '@zapbip/types';
import { localePathOf } from '../../src/site/site-language';
import { expect, test } from './fixtures';

const HINDI_PATH = localePathOf({ locale: OwnerLocale.Hindi });
const PHONE_WIDTH = 360;
const NO_SIDEWAYS_SCROLL_SCRIPT = 'document.documentElement.scrollWidth <= document.documentElement.clientWidth';
const HEADING_SPACING_SCRIPT = "getComputedStyle(document.querySelector('h1')).letterSpacing";
const DEVANAGARI_DIGIT_PATTERN = /[०-९]/;

for (const width of [PHONE_WIDTH, undefined]) {
  test.describe(width === undefined ? 'desktop' : `${width} px`, () => {
    if (width !== undefined) test.use({ viewport: { width, height: 800 } });

    test('the page reads left to right in Hindi and never scrolls sideways', async ({ page }) => {
      await page.goto(HINDI_PATH);
      await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
      expect(await page.evaluate(NO_SIDEWAYS_SCROLL_SCRIPT)).toBe(true);
    });

    test('Devanagari headings use no letter spacing', async ({ page }) => {
      await page.goto(HINDI_PATH);
      expect(['normal', '0px']).toContain(await page.evaluate(HEADING_SPACING_SCRIPT));
    });

    test('prices and counts keep Latin digits', async ({ page }) => {
      await page.goto(HINDI_PATH);
      expect(await page.locator('body').innerText()).not.toMatch(DEVANAGARI_DIGIT_PATTERN);
    });
  });
}
