import { PNG_SIGNATURE_LENGTH } from './support/png';
import { expect, test } from './fixtures';

const OPEN_GRAPH_WIDTH = 1200;
const OPEN_GRAPH_HEIGHT = 630;
const WIDTH_OFFSET = 16;
const HEIGHT_OFFSET = 20;

test('robots, sitemap, canonical, Open Graph and favicon', async ({ page, request, baseURL }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain('hreflang="pt-BR"');
  expect(sitemapText).toContain('hreflang="en"');
  await page.goto('/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${baseURL}/?lang=en`);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  const imageUrl = (await page.locator('meta[property="og:image"]').getAttribute('content'))!;
  const image = await request.get(new URL(imageUrl).pathname);
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toBe('image/png');
  const bytes = await image.body();
  expect(bytes.readUInt32BE(WIDTH_OFFSET)).toBe(OPEN_GRAPH_WIDTH);
  expect(bytes.readUInt32BE(HEIGHT_OFFSET)).toBe(OPEN_GRAPH_HEIGHT);
  expect(bytes.length).toBeGreaterThan(PNG_SIGNATURE_LENGTH);
  expect((await request.get('/favicon.svg')).status()).toBe(200);
});

test.describe('pt-BR browser', () => {
  test.use({ locale: 'pt-BR' });

  test('the social image and the demo are the Portuguese ones', async ({ page, request }) => {
    await page.goto('/');
    const imageUrl = (await page.locator('meta[property="og:image"]').getAttribute('content'))!;
    expect(imageUrl).toContain('og-pt_BR.png');
    expect((await request.get(new URL(imageUrl).pathname)).status()).toBe(200);
    await expect(page.locator('.demo-video source[type="video/mp4"]')).toHaveAttribute('src', /demo-pt_BR-960\.mp4$/);
    await expect(page.locator('.demo-poster')).toHaveAttribute('src', /demo-pt_BR-poster-960\.webp$/);
    await expect(page.locator('.cf-turnstile')).toHaveAttribute('data-language', 'pt-br');
  });
});
