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
});
