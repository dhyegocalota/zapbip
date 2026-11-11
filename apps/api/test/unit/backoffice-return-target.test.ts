import { describe, expect, it } from 'vitest';
import { returnTargetOf } from '../../src/backoffice/return-target';

const HOME = '/';
const BACKOFFICE_PAGES = ['/', '/sign-in', '/numbers', '/numbers/abc', '/metrics', '/audit'];
const HOSTILE_TARGETS = [
  '//evil.test',
  'https://evil.test/',
  '/\\evil.test',
  'javascript:alert(1)',
  '/numbers/%0d%0a',
  '/numbers/\r\nSet-Cookie: a=b',
  '/numbers/../x',
  '/unknown',
  '',
  null,
];

describe('returnTargetOf', () => {
  it.each(BACKOFFICE_PAGES)('keeps the backoffice page %s', (returnTo) => {
    expect(returnTargetOf({ returnTo })).toBe(returnTo);
  });

  it('drops the query and the fragment', () => {
    expect(returnTargetOf({ returnTo: '/metrics?period=7d#top' })).toBe('/metrics');
  });

  it.each(HOSTILE_TARGETS)('sends %j home', (returnTo) => {
    expect(returnTargetOf({ returnTo })).toBe(HOME);
  });
});
