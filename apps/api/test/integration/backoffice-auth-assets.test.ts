import { describe, expect, test } from 'vitest';
import { stylesheetHrefFor } from '../../src/backoffice/assets/stylesheet';
import { openSignInForm, requestBackoffice } from './backoffice-auth-fixtures';

const STATUS_OK = 200;
const STATUS_NOT_FOUND = 404;
const STYLESHEET_PATH = '/assets/backoffice.css';
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
