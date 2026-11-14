import { REPOSITORY_URL } from '../../src/site/site-constants';
import { SiteCopyKey } from '../../src/site/site-copy';
import { expect, test } from './fixtures';
import { siteCopy } from './support/site-copy';

const VIEWPORTS = [
  { name: '375', width: 375, height: 812 },
  { name: '1440', width: 1440, height: 900 },
];
const COLOR_SCHEMES = ['light', 'dark'] as const;
const NO_SIDEWAYS_SCROLL_SCRIPT = 'document.documentElement.scrollWidth <= document.documentElement.clientWidth';
const GITHUB_NAME_PATTERN = /GitHub/;
const EDGE_TOLERANCE = 1;

for (const viewport of VIEWPORTS) {
  for (const colorScheme of COLOR_SCHEMES) {
    test.describe(`${viewport.name} px in the ${colorScheme} scheme`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height }, colorScheme });

      test('the header shows the GitHub button inside the bar, next to the brand', async ({ page }) => {
        await page.goto('/');
        const button = page.locator('.site-header .github-link');
        await expect(button).toBeVisible();
        await expect(button).toHaveAttribute('href', REPOSITORY_URL);
        await expect(button).toHaveAccessibleName(GITHUB_NAME_PATTERN);
        await expect(button.locator('svg.github-mark')).toBeVisible();
        const bar = (await page.locator('.site-header .container').boundingBox())!;
        const box = (await button.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(bar.x - EDGE_TOLERANCE);
        expect(box.x + box.width).toBeLessThanOrEqual(bar.x + bar.width + EDGE_TOLERANCE);
        expect(box.y).toBeGreaterThanOrEqual(bar.y - EDGE_TOLERANCE);
        expect(box.y + box.height).toBeLessThanOrEqual(bar.y + bar.height + EDGE_TOLERANCE);
        expect(await page.evaluate(NO_SIDEWAYS_SCROLL_SCRIPT)).toBe(true);
      });

      test('the hero badge says open source and links the repository', async ({ page }) => {
        await page.goto('/');
        const badge = page.locator('.hero-source');
        await expect(badge).toBeVisible();
        await expect(badge).toHaveAttribute('href', REPOSITORY_URL);
        await expect(badge).toContainText(siteCopy({ key: SiteCopyKey.HeroOpenSource }));
      });

      test('the pricing names zapbip Cloud and its Brazilian number', async ({ page }) => {
        await page.goto('/#pricing');
        await expect(page.locator('#pricing')).toContainText(siteCopy({ key: SiteCopyKey.PricingEyebrow }), { ignoreCase: true });
        await expect(page.getByText(siteCopy({ key: SiteCopyKey.PricingCloudNumber }))).toBeVisible();
      });
    });
  }
}
