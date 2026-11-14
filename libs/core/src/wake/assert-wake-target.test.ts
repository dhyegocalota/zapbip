import { GENERIC_WAKE_PROVIDER, InboxErrorCode } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { captureInboxError } from '../inbox/testing/capture-inbox-error';
import { assertWakeTarget } from './assert-wake-target';
import { WAKE_TOKEN_MAX_CHARS, WAKE_URL_MAX_CHARS } from './constants';
import { ALPHA_PROVIDER, ALPHA_URL, BETA_PROVIDER, BETA_URL, FIXTURE_PINNED_PROVIDERS } from './testing/wake-pinned-fixtures';

const PUBLIC_HOST = 'zapbip.example';
const SHORT_TOKEN = 'a'.repeat(16);
const LONG_TOKEN = 'b'.repeat(32);
const GENERIC_URL = 'https://hooks.example.com/zapbip';

function guard(input: { url: string; token: string; publicHost?: string }) {
  const { url, token, publicHost = PUBLIC_HOST } = input;
  return assertWakeTarget({ url, token, publicHost, pinnedProviders: FIXTURE_PINNED_PROVIDERS });
}

async function rejection(input: { url: string; token: string; publicHost?: string }) {
  return captureInboxError(() => guard(input));
}

function paddedUrl(input: { length: number }): string {
  const prefix = 'https://hooks.example.com/';
  return `${prefix}${'a'.repeat(input.length - prefix.length)}`;
}

describe('assertWakeTarget providers', () => {
  test('an alpha routine URL selects alpha_routine and keeps the URL', () => {
    expect(guard({ url: ALPHA_URL, token: SHORT_TOKEN })).toEqual({ provider: ALPHA_PROVIDER, url: ALPHA_URL, token: SHORT_TOKEN });
  });

  test('a beta routine URL selects beta_routine', () => {
    expect(guard({ url: BETA_URL, token: SHORT_TOKEN }).provider).toBe(BETA_PROVIDER);
  });

  test('another host selects generic', () => {
    expect(guard({ url: GENERIC_URL, token: LONG_TOKEN }).provider).toBe(GENERIC_WAKE_PROVIDER);
  });

  test('an alpha host with a short routine id is refused naming url without echoing it', async () => {
    const url = 'https://alpha-routines.example/hooks/short';
    const error = await rejection({ url, token: SHORT_TOKEN });
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'invalid url' });
  });

  test('the Anthropic host with the internal path never falls back to generic', async () => {
    const error = await rejection({ url: 'https://beta-routines.example/v1/other/trig_1/run', token: LONG_TOKEN });
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'invalid url' });
  });

  test('look-alike hosts of a pinned provider are generic and need the long token', async () => {
    const lookAlike = 'https://alpha-routines.example.evil.example/hooks/abcdefgh12';
    expect(await rejection({ url: lookAlike, token: SHORT_TOKEN })).toEqual({
      code: InboxErrorCode.InvalidInput,
      message: 'invalid token',
    });
    expect(guard({ url: lookAlike, token: LONG_TOKEN }).provider).toBe(GENERIC_WAKE_PROVIDER);
    const betaLookAlike = 'https://beta-routines.example.evil.example/v1/claude_code/routines/trig_01abc/fire';
    expect(await rejection({ url: betaLookAlike, token: SHORT_TOKEN })).toEqual({
      code: InboxErrorCode.InvalidInput,
      message: 'invalid token',
    });
    expect(guard({ url: betaLookAlike, token: LONG_TOKEN }).provider).toBe(GENERIC_WAKE_PROVIDER);
  });

  test('a trailing dot on the pinned host is refused naming url', async () => {
    const error = await rejection({ url: 'https://alpha-routines.example./hooks/abcdefgh12', token: SHORT_TOKEN });
    expect(error).toEqual({ code: InboxErrorCode.InvalidInput, message: 'invalid url' });
  });

  test('a mixed-case host is accepted', () => {
    expect(guard({ url: 'https://HOOKS.Example.com/x', token: LONG_TOKEN }).provider).toBe(GENERIC_WAKE_PROVIDER);
  });

  test('the own host and its subdomains are blocked', async () => {
    expect(await rejection({ url: 'https://zapbip.example/hook', token: LONG_TOKEN })).toEqual({
      code: InboxErrorCode.InvalidInput,
      message: 'invalid url',
    });
    expect(await rejection({ url: 'https://sub.zapbip.example/hook', token: LONG_TOKEN })).toEqual({
      code: InboxErrorCode.InvalidInput,
      message: 'invalid url',
    });
  });
});

describe('assertWakeTarget tokens', () => {
  const invalidTokens: Record<string, { url: string; token: string }> = {
    'a generic token of 31 characters': { url: GENERIC_URL, token: 'c'.repeat(31) },
    'a pinned token of 15 characters': { url: ALPHA_URL, token: 'd'.repeat(15) },
    'a pinned token of 513 characters': { url: ALPHA_URL, token: 'e'.repeat(WAKE_TOKEN_MAX_CHARS + 1) },
    'a token with a space': { url: ALPHA_URL, token: 'abc def ghijklmnop' },
    'a token with a non-ASCII letter': { url: ALPHA_URL, token: 'abcdefghijklmnoé' },
    'an empty token': { url: GENERIC_URL, token: '' },
  };

  test.each(Object.entries(invalidTokens))('%s is refused naming token', async (_name, target) => {
    expect(await rejection(target)).toEqual({ code: InboxErrorCode.InvalidInput, message: 'invalid token' });
  });

  test('pinned tokens of 16 and of 512 characters are accepted', () => {
    expect(guard({ url: ALPHA_URL, token: 'f'.repeat(16) }).provider).toBe(ALPHA_PROVIDER);
    expect(guard({ url: ALPHA_URL, token: 'f'.repeat(WAKE_TOKEN_MAX_CHARS) }).provider).toBe(ALPHA_PROVIDER);
  });
});

describe('assertWakeTarget host forms', () => {
  test.each(['zapbip.example', 'https://zapbip.example', 'https://zapbip.example/'])(
    'the own host given as %s is refused',
    async (publicHost) => {
      expect(await rejection({ url: 'https://zapbip.example/hook', token: LONG_TOKEN, publicHost })).toEqual({
        code: InboxErrorCode.InvalidInput,
        message: 'invalid url',
      });
    },
  );

  test.each(['https://zapbip.example:8787', 'https://zapbip.example/some/path', 'HTTPS://ZAPBIP.EXAMPLE'])(
    'the own host given as the origin %s is refused',
    async (publicHost) => {
      expect(await rejection({ url: 'https://a.b.zapbip.example/hook', token: LONG_TOKEN, publicHost })).toEqual({
        code: InboxErrorCode.InvalidInput,
        message: 'invalid url',
      });
    },
  );

  test.each(['https://notzapbip.example/x', 'https://zapbip.example.evil.com/x', 'https://myzapbip.com/x'])(
    '%s only resembles a blocked host and is accepted',
    (url) => {
      expect(guard({ url, token: LONG_TOKEN }).provider).toBe(GENERIC_WAKE_PROVIDER);
    },
  );

  test.each([
    'https://evil-alpha-routines.example/x',
    'https://x.alpha-routines.example/x',
    'https://x.beta-routines.example/x',
    'https://alpha-routines.example.evil.example/x',
    'https://beta-routines.example.evil.example/x',
    'https://xbeta-routines.example/x',
  ])('%s is a generic target and never a pinned provider', (url) => {
    expect(guard({ url, token: LONG_TOKEN }).provider).toBe(GENERIC_WAKE_PROVIDER);
  });

  test('app.localhost is refused', async () => {
    expect(await rejection({ url: 'https://app.localhost/x', token: LONG_TOKEN })).toEqual({
      code: InboxErrorCode.InvalidInput,
      message: 'invalid url',
    });
  });
});

describe('assertWakeTarget urls', () => {
  const invalidUrls: Record<string, string> = {
    'plain http': 'http://hooks.example.com/x',
    userinfo: 'https://user:pass@hooks.example.com/x',
    'a custom port': 'https://hooks.example.com:8443/x',
    'a bare fragment mark': 'https://hooks.example.com/x#',
    'a fragment': 'https://hooks.example.com/x#frag',
    'a url over the limit': paddedUrl({ length: WAKE_URL_MAX_CHARS + 1 }),
    'leading whitespace': '  https://hooks.example.com/x',
    'an empty url': '',
    'a private IPv4': 'https://10.0.0.5/x',
    'a loopback IPv4': 'https://127.0.0.1/x',
    'the metadata IPv4': 'https://169.254.169.254/x',
    'a decimal IPv4': 'https://2130706433/x',
    'a shortened IPv4': 'https://127.1/x',
    'a hex IPv4': 'https://0x7f.1/x',
    'an IPv6 literal': 'https://[::1]/x',
    'a mapped IPv6 literal': 'https://[::ffff:127.0.0.1]/x',
    localhost: 'https://localhost/x',
    'upper-case localhost': 'https://LOCALHOST/x',
    'localhost with a trailing dot': 'https://localhost./x',
    'a local name': 'https://printer.local/x',
    'an internal name': 'https://db.internal/x',
    'an internal name with a trailing dot': 'https://db.internal./x',
    'a lan name': 'https://nas.lan/x',
    'an arpa name': 'https://1.in-addr.arpa/x',
    'a wildcard localhost': 'https://*.localhost/x',
    'a single-label host': 'https://metadata/',
    'localhost.localdomain': 'https://localhost.localdomain/x',
    'the product apex': 'https://zapbip.com/x',
    'a product subdomain': 'https://hooks.zapbip.com/x',
    'a workers.dev host': 'https://wake.account.workers.dev/x',
    'the workers.dev apex': 'https://workers.dev/x',
    'a localdomain host': 'https://a.localhost.localdomain/x',
    'the own host': `https://${PUBLIC_HOST}/x`,
    'an own host subdomain': `https://hooks.${PUBLIC_HOST}/x`,
  };

  test.each(Object.entries(invalidUrls))('%s is refused naming url', async (_name, url) => {
    expect(await rejection({ url, token: LONG_TOKEN })).toEqual({ code: InboxErrorCode.InvalidInput, message: 'invalid url' });
  });

  test('port 443 is accepted', () => {
    expect(guard({ url: 'https://hooks.example.com:443/x', token: LONG_TOKEN }).provider).toBe(GENERIC_WAKE_PROVIDER);
  });

  test('a url of exactly the limit is accepted', () => {
    expect(guard({ url: paddedUrl({ length: WAKE_URL_MAX_CHARS }), token: LONG_TOKEN }).provider).toBe(GENERIC_WAKE_PROVIDER);
  });

  test('the error never carries the url or its userinfo', async () => {
    const error = await rejection({ url: 'https://user:pass@hooks.example.com/x', token: LONG_TOKEN });
    expect(error.message).not.toMatch(/user|pass|hooks/);
  });
});
