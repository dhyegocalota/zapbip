import { devices } from '@playwright/test';
import { expect, test } from './fixtures';

const LCP_BUDGET_MS = 2_500;
const BYTES_PER_BIT = 8;
const SLOW_FOUR_G = {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / BYTES_PER_BIT,
  uploadThroughput: (750 * 1024) / BYTES_PER_BIT,
  latency: 150,
};
const OBSERVER_SCRIPT = `
  window.largest = null;
  new PerformanceObserver((list) => {
    const entry = list.getEntries().at(-1);
    window.largest = { time: entry.startTime, className: entry.element ? entry.element.className : '' };
  }).observe({ type: 'largest-contentful-paint', buffered: true });
`;
const LARGEST_SCRIPT = 'window.largest';
const POSTER_IS_LARGEST_SCRIPT = "window.largest !== null && window.largest.className.includes('demo-poster')";

test.use({ ...devices['Pixel 5'], locale: 'en-US' });

test('LCP under 2.5 s on mobile, the poster is the LCP element and the video waits', async ({ page, request }) => {
  const session = await page.context().newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', SLOW_FOUR_G);
  await page.addInitScript(OBSERVER_SCRIPT);
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForFunction(POSTER_IS_LARGEST_SCRIPT);
  const largest = (await page.evaluate(LARGEST_SCRIPT)) as { time: number; className: string };
  expect(largest.time).toBeLessThan(LCP_BUDGET_MS);
  const html = await (await request.get('/')).text();
  expect(html).toMatch(/<video[^>]*preload="none"/);
});
