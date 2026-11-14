import { devices } from '@playwright/test';
import { expect, test } from './fixtures';

const CPU_SLOWDOWN_RATE = 4;
const SCRIPT_INIT_BUDGET_MS = 50;
const SCRIPT_PATH_PATTERN = '**/site/site.js*';
const START_MARK = 'site-script-start';
const END_MARK = 'site-script-end';
const MEASURE_NAME = 'site-script-init';
const DIRTY_LAYOUT_SOURCE = "document.documentElement.style.fontSize = '17px';";
const INIT_DURATION_SCRIPT = `performance.getEntriesByName('${MEASURE_NAME}')[0].duration`;

test.use({ ...devices['Pixel 5'], locale: 'en-US', bypassCSP: true });

test('site.js init runs no task over 50 ms under a 4x CPU slowdown', async ({ page }) => {
  await page.route(SCRIPT_PATH_PATTERN, async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({
      response,
      body: `${DIRTY_LAYOUT_SOURCE}performance.mark('${START_MARK}');${source}\nperformance.mark('${END_MARK}');performance.measure('${MEASURE_NAME}', '${START_MARK}', '${END_MARK}');`,
    });
  });
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN_RATE });
  await page.goto('/', { waitUntil: 'load' });
  const duration = (await page.evaluate(INIT_DURATION_SCRIPT)) as number;
  expect(duration).toBeLessThan(SCRIPT_INIT_BUDGET_MS);
});
