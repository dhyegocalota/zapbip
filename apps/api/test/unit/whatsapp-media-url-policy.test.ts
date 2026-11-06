import { describe, expect, it } from 'vitest';
import { isAllowedMediaUrl } from '../../src/adapters/whatsapp/media-url-policy';

const DEVELOPMENT_ORIGIN = 'http://127.0.0.1:4011';
const META_URL = 'https://lookaside.fbsbx.com/image';
const DEVELOPMENT_URL = `${DEVELOPMENT_ORIGIN}/media/image`;

describe('isAllowedMediaUrl', () => {
  it('allows an https Meta host without a development origin', () => {
    expect(isAllowedMediaUrl({ url: META_URL, developmentMediaOrigin: null })).toBe(true);
  });

  it('refuses the development origin when none is configured', () => {
    expect(isAllowedMediaUrl({ url: DEVELOPMENT_URL, developmentMediaOrigin: null })).toBe(false);
  });

  it('allows the configured development origin over http', () => {
    expect(isAllowedMediaUrl({ url: DEVELOPMENT_URL, developmentMediaOrigin: DEVELOPMENT_ORIGIN })).toBe(true);
  });

  it('keeps allowing Meta hosts when a development origin is configured', () => {
    expect(isAllowedMediaUrl({ url: META_URL, developmentMediaOrigin: DEVELOPMENT_ORIGIN })).toBe(true);
  });

  it.each([
    ['another port', 'http://127.0.0.1:4012/media/image'],
    ['another host', 'http://localhost:4011/media/image'],
    ['userinfo that names the configured host', 'http://127.0.0.1:4011@evil.com/x'],
    ['a plain http foreign host', 'http://media.fbsbx.com/image'],
    ['an https foreign host', 'https://evil.com/.fbsbx.com/x'],
  ])('refuses %s even when a development origin is configured', (_name, url) => {
    expect(isAllowedMediaUrl({ url, developmentMediaOrigin: DEVELOPMENT_ORIGIN })).toBe(false);
  });

  it('refuses a string that is not a url', () => {
    expect(isAllowedMediaUrl({ url: 'not a url', developmentMediaOrigin: DEVELOPMENT_ORIGIN })).toBe(false);
  });

  it.each([
    'https://fbsbx.com.evil.com/x',
    'https://evil.com#.fbsbx.com',
    'https://evil.com?.fbsbx.com',
    'https://evil.com\\@x.fbsbx.com/',
    'https://user:pw@evil.com/',
    'ftp://x.fbsbx.com/',
    'file:///etc/passwd',
    'https://127.0.0.1/x',
    'https://[::1]/x',
    'https://2130706433/x',
    'https://localhost/x',
    'https://x.fbsbx.com.evil.com/',
    'https://xn--fbsbx-0wa.com/',
    'javascript:alert(1)',
    'data:text/plain,hi',
    '//x.fbsbx.com/x',
    'http://127.0.0.1:4011.evil.com/x',
    'http://127.0.0.1:40110/x',
    'https://127.0.0.1:4011/x',
    'http://localhost:4011/x',
    'http://[::ffff:127.0.0.1]:4011/x',
  ])('pin: refuses the lookalike %s with and without a development origin', (url) => {
    expect(isAllowedMediaUrl({ url, developmentMediaOrigin: null })).toBe(false);
    expect(isAllowedMediaUrl({ url, developmentMediaOrigin: DEVELOPMENT_ORIGIN })).toBe(false);
  });

  it('pin: refuses the short loopback form 127.1 in production, where no development origin exists', () => {
    expect(isAllowedMediaUrl({ url: 'http://127.1:4011/x', developmentMediaOrigin: null })).toBe(false);
  });
});
