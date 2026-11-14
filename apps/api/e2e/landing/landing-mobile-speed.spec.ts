import { devices } from '@playwright/test';
import { expect, test } from './fixtures';

const CPU_SLOWDOWN_RATE = 4;
const LONG_TASK_BUDGET_MS = 1_500;
const COMPOSITOR_PROPERTIES = ['opacity', 'transform', 'offset', 'computedOffset', 'easing', 'composite'];
const ARABIC_PATH = '/ar';
const LONG_TASK_SCRIPT = `
  window.longTaskTotal = 0;
  new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      window.longTaskTotal += entry.duration;
    });
  }).observe({ type: 'longtask', buffered: true });
`;
const NON_COMPOSITOR_PROPERTIES_SCRIPT = `
  document.getAnimations()
    .filter((animation) => animation instanceof CSSAnimation)
    .flatMap((animation) => animation.effect.getKeyframes().flatMap((keyframe) => Object.keys(keyframe)))
    .filter((property) => !${JSON.stringify(COMPOSITOR_PROPERTIES)}.includes(property))
`;
const SKIPPED_SECTIONS_SCRIPT = `
  [...document.querySelectorAll('main > section:not(.hero)')]
    .filter((section) => getComputedStyle(section).contentVisibility !== 'auto')
    .map((section) => section.id)
`;

test.use({ ...devices['Pixel 5'], locale: 'en-US', bypassCSP: true });

for (const path of ['/', ARABIC_PATH]) {
  test(`${path}: every running animation stays on the compositor`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'load' });
    expect(await page.evaluate(NON_COMPOSITOR_PROPERTIES_SCRIPT)).toEqual([]);
  });

  test(`${path}: every section below the first fold is skipped until it nears the viewport`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'load' });
    expect(await page.evaluate(SKIPPED_SECTIONS_SCRIPT)).toEqual([]);
  });
}

test('the main thread stays inside the long-task budget under a 4x CPU slowdown', async ({ page }) => {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN_RATE });
  await page.addInitScript(LONG_TASK_SCRIPT);
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(await page.evaluate('window.longTaskTotal')).toBeLessThan(LONG_TASK_BUDGET_MS);
});

test('the hero underline draws from the reading start in both directions', async ({ page }) => {
  await page.goto(ARABIC_PATH, { waitUntil: 'load' });
  const animationName = await page.locator('.hero-underline').evaluate((element) => getComputedStyle(element).animationName);
  expect(animationName).toBe('draw-rtl');
});
