import { describe, expect, test } from 'vitest';
import { stylesheetHrefFor } from '../../src/backoffice/assets/stylesheet';
import { openSignInForm, requestBackoffice } from './backoffice-auth-fixtures';

const STATUS_OK = 200;
const STATUS_NOT_FOUND = 404;
const STYLESHEET_PATH = '/assets/backoffice.css';
const FAVICON_PATH = '/assets/favicon.svg';
const LEGACY_FAVICON_PATH = '/favicon.ico';
const FAVICON_CONTENT_TYPE = 'image/svg+xml';
const OTHER_HEADERS = [
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'permissions-policy',
  'x-robots-tag',
];

describe('stylesheet', () => {
  test('is public, cacheable forever and still carries the other security headers', async () => {
    const response = await requestBackoffice({ path: STYLESHEET_PATH });
    expect(response.status).toBe(STATUS_OK);
    expect(response.headers.get('content-type')).toBe('text/css; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    OTHER_HEADERS.forEach((name) => expect(response.headers.get(name)).not.toBeNull());
  });

  test('imports nothing, loads nothing from another origin and embeds no data URI', async () => {
    const css = await (await requestBackoffice({ path: STYLESHEET_PATH })).text();
    expect(css).not.toContain('@import');
    expect(css).not.toContain('data:');
    expect(css.match(/url\(/g)).toBeNull();
  });

  test('pages link the stylesheet by content hash', async () => {
    const css = await (await requestBackoffice({ path: STYLESHEET_PATH })).text();
    const { response } = await openSignInForm({});
    expect(await response.text()).toContain(`href="${stylesheetHrefFor({ css })}"`);
  });

  test('the version changes when the content does', () => {
    expect(stylesheetHrefFor({ css: 'a{}' })).not.toBe(stylesheetHrefFor({ css: 'b{}' }));
    expect(stylesheetHrefFor({ css: 'a{}' })).toMatch(/^\/assets\/backoffice\.css\?v=[0-9a-f]+$/);
  });

  test('a POST to the stylesheet is a 404', async () => {
    const response = await requestBackoffice({ path: STYLESHEET_PATH, method: 'POST', form: {} });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });
});

describe('favicon', () => {
  test.each([FAVICON_PATH, LEGACY_FAVICON_PATH])('%s is public, cacheable and carries the other security headers', async (path) => {
    const response = await requestBackoffice({ path });
    expect(response.status).toBe(STATUS_OK);
    expect(response.headers.get('content-type')).toBe(FAVICON_CONTENT_TYPE);
    expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    OTHER_HEADERS.forEach((name) => expect(response.headers.get(name)).not.toBeNull());
  });

  test('is an svg that runs no script and loads nothing', async () => {
    const svg = await (await requestBackoffice({ path: FAVICON_PATH })).text();
    expect(svg).toMatch(/^<svg /);
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('href=');
  });

  test('pages link it as the icon', async () => {
    const { response } = await openSignInForm({});
    expect(await response.text()).toContain(`<link rel="icon" href="${FAVICON_PATH}" type="${FAVICON_CONTENT_TYPE}"`);
  });

  test('a POST to the favicon is a 404', async () => {
    const response = await requestBackoffice({ path: FAVICON_PATH, method: 'POST', form: {} });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });
});
