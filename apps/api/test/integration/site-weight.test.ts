import { describe, expect, it } from 'vitest';
import { CLIENT_APP_STYLESHEET } from '../../src/client-app/client-app-stylesheet';
import { SITE_SCRIPT } from '../../src/site/site-scripts';
import { SITE_STYLESHEET } from '../../src/site/site-stylesheet';
import { siteFetch } from '../support/site';

const HOME_HTML_LIMIT_BYTES = 60_000;
const SITE_STYLESHEET_LIMIT_BYTES = 62_000;
const SITE_SCRIPT_LIMIT_BYTES = 40_000;
const CLIENT_APP_STYLESHEET_LIMIT_BYTES = 25_000;
const IMMUTABLE = 'public, max-age=31536000, immutable';
const PRELOAD_PATTERN = /<link rel="preload"/g;
const IMAGE_PATTERN = /<img [^>]*>/g;

function byteLengthOf(input: { text: string }): number {
  return new TextEncoder().encode(input.text).length;
}

async function htmlOf(input: { path: string }): Promise<string> {
  return (await siteFetch({ path: input.path })).text();
}

describe('the weight of the landing page and the app', () => {
  it('keeps the home page, the stylesheets and the script inside their budgets', async () => {
    expect(byteLengthOf({ text: await htmlOf({ path: '/' }) })).toBeLessThan(HOME_HTML_LIMIT_BYTES);
    expect(byteLengthOf({ text: SITE_STYLESHEET })).toBeLessThan(SITE_STYLESHEET_LIMIT_BYTES);
    expect(byteLengthOf({ text: SITE_SCRIPT })).toBeLessThan(SITE_SCRIPT_LIMIT_BYTES);
    expect(byteLengthOf({ text: CLIENT_APP_STYLESHEET })).toBeLessThan(CLIENT_APP_STYLESHEET_LIMIT_BYTES);
  });

  it.each(['/site/site.css', '/site/site.js'])('serves %s hashed and immutable', async (path) => {
    const response = await siteFetch({ path });
    expect(response.headers.get('Cache-Control')).toBe(IMMUTABLE);
  });

  it('links a stylesheet and a script by content hash', async () => {
    const html = await htmlOf({ path: '/' });
    expect(html).toMatch(/href="\/site\/site\.css\?v=[0-9a-f]+"/);
    expect(html).toMatch(/src="\/site\/site\.js\?v=[0-9a-f]+" defer/);
  });

  it('preloads the hero poster once on the home page and nothing on a legal page', async () => {
    expect((await htmlOf({ path: '/' })).match(PRELOAD_PATTERN)).toHaveLength(1);
    expect((await htmlOf({ path: '/terms' })).match(PRELOAD_PATTERN)).toBeNull();
  });

  it('gives the poster a high fetch priority and its size, and every other image lazy loading', async () => {
    const [poster, ...others] = (await htmlOf({ path: '/' })).match(IMAGE_PATTERN)!;
    expect(poster).toContain('fetchpriority="high"');
    expect(poster).toMatch(/width="\d+" height="\d+"/);
    others.forEach((image) => expect(image).toContain('loading="lazy"'));
  });

  it('keeps the video from loading until the script asks', async () => {
    expect(await htmlOf({ path: '/' })).toMatch(/<video[^>]*preload="none"/);
  });
});
