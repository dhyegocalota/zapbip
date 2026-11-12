import { expect, test } from './fixtures';

const MOBILE_WIDTH = 375;
const SIDE_GUTTER = 16;
const MAXIMUM_LAYOUT_SHIFT = 0.01;
const OBSERVE_MS = 3_000;
const SCROLL_DISTANCE = 4_000;
const OBSERVER_SCRIPT = `
  window.layoutShifts = [];
  new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (!entry.hadRecentInput) window.layoutShifts.push(entry.value);
    });
  }).observe({ type: 'layout-shift', buffered: true });
`;
const TOTAL_SHIFT_SCRIPT = 'window.layoutShifts.reduce((sum, value) => sum + value, 0)';
const SCROLL_WIDTH_SCRIPT = 'document.documentElement.scrollWidth';

test('no layout shift on load', async ({ page }) => {
  await page.addInitScript(OBSERVER_SCRIPT);
  await page.goto('/');
  await page.mouse.wheel(0, SCROLL_DISTANCE);
  await page.waitForTimeout(OBSERVE_MS);
  expect(await page.evaluate(TOTAL_SHIFT_SCRIPT)).toBeLessThanOrEqual(MAXIMUM_LAYOUT_SHIFT);
});

test.describe('375 px', () => {
  test.use({ viewport: { width: MOBILE_WIDTH, height: 812 } });

  test('no horizontal scroll', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(SCROLL_WIDTH_SCRIPT)).toBeLessThanOrEqual(MOBILE_WIDTH);
  });

  test('a 16 px side gutter', async ({ page }) => {
    await page.goto('/');
    const box = (await page.locator('.hero-title').boundingBox())!;
    expect(box.x).toBe(SIDE_GUTTER);
  });
});
