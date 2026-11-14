import { devices } from '@playwright/test';
import { expect, test } from './fixtures';

const LCP_BUDGET_MS = 2_000;
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
const SHIFT_SCRIPT = `
  window.shift = 0;
  new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      if (!entry.hadRecentInput) window.shift += entry.value;
    });
  }).observe({ type: 'layout-shift', buffered: true });
`;
const SCROLL_TO_END_SCRIPT = 'window.scrollTo(0, document.body.scrollHeight)';
const TURNSTILE_ADDRESS = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
const POSTER_IS_LARGEST_SCRIPT = "window.largest !== null && window.largest.className.includes('demo-poster')";

test.use({ ...devices['Pixel 5'], locale: 'en-US', bypassCSP: true });

test('LCP under 2.0 s on mobile, the poster is the LCP element and the video waits', async ({ page, request }) => {
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

test('the page never shifts, before or after the reveal and the lazy media', async ({ page }) => {
  await page.addInitScript(SHIFT_SCRIPT);
  await page.goto('/', { waitUntil: 'load' });
  await page.evaluate(SCROLL_TO_END_SCRIPT);
  await page.waitForLoadState('networkidle');
  expect(await page.evaluate('window.shift')).toBe(0);
});

test('the Turnstile script waits for the form to be touched', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto('/', { waitUntil: 'networkidle' });
  expect(requested.filter((url) => url.startsWith(TURNSTILE_ADDRESS))).toEqual([]);
  const turnstileRequest = page.waitForRequest((request) => request.url().startsWith(TURNSTILE_ADDRESS));
  await page.locator('#join-email').focus();
  await turnstileRequest;
});
