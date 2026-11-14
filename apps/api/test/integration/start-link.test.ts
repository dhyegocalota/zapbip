import { createExecutionContext, env, reset } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import {
  DocsPageLanguage,
  INSTALL_PAGE_PATH_PREFIX,
  INSTALL_PAGE_REQUESTS_PER_MINUTE,
  OwnerLocale,
  START_LINK_PATH,
  START_PREFILLED_TEXT,
  WhatsAppNumberState,
} from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import production from '../../src/index';
import { START_LINK_COPY } from '../../src/routes/start-link-copy';
import { START_LINK_STYLE_HASH } from '../../src/routes/start-link-style';
import { startInFreshWindow } from '../support/rate-limit-window';
import { applyDirectoryMigration } from '../support/seed';
import { captureLogLines } from '../support/capture-log-lines';
import { changeStartNumberState, seedStartNumber } from '../support/start-link-numbers';
import { testEnv } from '../support/workers-env';

const ORIGIN = 'http://localhost:8787';
const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip';
const CLIENT_ADDRESS = '203.0.113.20';
const LIMITED_ADDRESS = '203.0.113.40';
const UNLIMITED_ADDRESS = '203.0.113.41';
const COUNTER_ADDRESS = '203.0.113.42';
const BACKOFFICE_ORIGIN = 'http://backoffice.localhost:8787';
const TRAILING_DOT_BACKOFFICE_ORIGIN = 'http://backoffice.localhost.:8787';
const OLDEST = 1_700_000_000_000;
const NEWER = OLDEST + 1_000;
const RETRY_AFTER_SECONDS = '60';
const FRESH_WINDOW_MARGIN_MS = 10_000;
const FRESH_WINDOW_TEST_TIMEOUT_MS = 90_000;
const ACTIVE_DISPLAY_NUMBER = '+5511977770001';
const ACTIVE_DIGITS = '5511977770001';
const OTHER_DISPLAY_NUMBER = '+5511977770002';
const OTHER_DIGITS = '5511977770002';
const BREAK_DISPLAY_NUMBER_STATEMENT = 'ALTER TABLE whatsapp_numbers RENAME COLUMN display_number TO moved_display_number';

function targetOf(input: { digits: string; locale: OwnerLocale }): string {
  return `https://wa.me/${input.digits}?text=${encodeURIComponent(START_PREFILLED_TEXT[input.locale])}`;
}

function getStart(input: { query?: string; address?: string; method?: string; path?: string }): Promise<Response> {
  const { query = '', address = CLIENT_ADDRESS, method = 'GET', path = START_LINK_PATH } = input;
  return exports.default.fetch(
    new Request(`${ORIGIN}${path}${query}`, { method, headers: { [CLIENT_ADDRESS_HEADER]: address }, redirect: 'manual' }),
  );
}

function expectPrivateHeaders(input: { headers: Headers }): void {
  const { headers } = input;
  expect(headers.get('cache-control')).toBe('no-store');
  expect(headers.get('x-robots-tag')).toBe('noindex');
  expect(headers.get('referrer-policy')).toBe('no-referrer');
  expect(headers.get('x-content-type-options')).toBe('nosniff');
  expect(headers.get('strict-transport-security')).toMatch(/^max-age=\d+/);
}

async function seedActiveNumber(): Promise<void> {
  await seedStartNumber({ numberId: 'num_a', displayNumber: ACTIVE_DISPLAY_NUMBER, state: WhatsAppNumberState.Active, createdAt: OLDEST });
}

beforeEach(applyDirectoryMigration);
afterEach(() => {
  vi.restoreAllMocks();
  return reset();
});

describe('start link redirect', () => {
  it('SL-W1 redirects to the wa.me link of the active number with the default locale text', async () => {
    await seedActiveNumber();
    const response = await getStart({});
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(targetOf({ digits: ACTIVE_DIGITS, locale: OwnerLocale.PortugueseBrazil }));
  });

  it.each([
    [DocsPageLanguage.English, OwnerLocale.EnglishUs],
    [DocsPageLanguage.PortugueseBrazil, OwnerLocale.PortugueseBrazil],
  ])('SL-W2 takes the text of lang=%s', async (language, locale) => {
    await seedActiveNumber();
    const response = await getStart({ query: `?lang=${language}` });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(targetOf({ digits: ACTIVE_DIGITS, locale }));
  });

  it('SL-W3 answers a HEAD request with the same redirect', async () => {
    await seedActiveNumber();
    const response = await getStart({ method: 'HEAD' });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(targetOf({ digits: ACTIVE_DIGITS, locale: OwnerLocale.PortugueseBrazil }));
  });

  it('SL-W4 carries the private headers on the redirect', async () => {
    await seedActiveNumber();
    expectPrivateHeaders({ headers: (await getStart({})).headers });
  });
});

describe('start link selection', () => {
  it('SL-W5 picks the oldest active number, skipping older closed, pending and disabled ones', async () => {
    await seedStartNumber({
      numberId: 'num_closed',
      displayNumber: '+5511977770010',
      state: WhatsAppNumberState.Closed,
      createdAt: OLDEST - 4,
    });
    await seedStartNumber({
      numberId: 'num_pending',
      displayNumber: '+5511977770011',
      state: WhatsAppNumberState.Pending,
      createdAt: OLDEST - 3,
    });
    await seedStartNumber({
      numberId: 'num_disabled',
      displayNumber: '+5511977770012',
      state: WhatsAppNumberState.Disabled,
      createdAt: OLDEST - 2,
    });
    await seedStartNumber({
      numberId: 'num_newer',
      displayNumber: OTHER_DISPLAY_NUMBER,
      state: WhatsAppNumberState.Active,
      createdAt: NEWER,
    });
    await seedActiveNumber();
    const response = await getStart({});
    expect(response.headers.get('location')).toBe(targetOf({ digits: ACTIVE_DIGITS, locale: OwnerLocale.PortugueseBrazil }));
  });

  it('SL-W6 breaks a tie of the creation time by the number id', async () => {
    await seedStartNumber({ numberId: 'num_b', displayNumber: OTHER_DISPLAY_NUMBER, state: WhatsAppNumberState.Active, createdAt: OLDEST });
    await seedActiveNumber();
    const response = await getStart({});
    expect(response.headers.get('location')).toBe(targetOf({ digits: ACTIVE_DIGITS, locale: OwnerLocale.PortugueseBrazil }));
  });

  it('SL-W7 follows the registry on the next request when the operator closes the number', async () => {
    await seedActiveNumber();
    await seedStartNumber({ numberId: 'num_b', displayNumber: OTHER_DISPLAY_NUMBER, state: WhatsAppNumberState.Active, createdAt: NEWER });
    expect((await getStart({})).headers.get('location')).toBe(targetOf({ digits: ACTIVE_DIGITS, locale: OwnerLocale.PortugueseBrazil }));
    await changeStartNumberState({ numberId: 'num_a', state: WhatsAppNumberState.Closed });
    expect((await getStart({})).headers.get('location')).toBe(targetOf({ digits: OTHER_DIGITS, locale: OwnerLocale.PortugueseBrazil }));
  });
});

const STYLE_BLOCK_PATTERN = /<style>([\s\S]*?)<\/style>/;

async function sha256Base64(input: { text: string }): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.text));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

describe('start link without a usable number', () => {
  async function expectUnavailablePage(input: { response: Response; first: OwnerLocale }): Promise<void> {
    const { response, first } = input;
    const body = await response.text();
    const second = Object.values(OwnerLocale).find((locale) => locale !== first) as OwnerLocale;
    expect(response.status).toBe(503);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('retry-after')).toBe(RETRY_AFTER_SECONDS);
    expect(response.headers.get('content-type')).toMatch(/^text\/html/);
    expect(response.headers.get('content-security-policy')).toBe(`default-src 'none'; style-src '${START_LINK_STYLE_HASH}'`);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const servedStyle = body.match(STYLE_BLOCK_PATTERN)?.[1] as string;
    expect(`sha256-${await sha256Base64({ text: servedStyle })}`).toBe(START_LINK_STYLE_HASH);
    expect(body).toContain(START_LINK_COPY[first].unavailableBody);
    expect(body).toContain(START_LINK_COPY[second].unavailableBody);
    expect(body.indexOf(START_LINK_COPY[first].unavailableBody)).toBeLessThan(body.indexOf(START_LINK_COPY[second].unavailableBody));
    expect(body).not.toContain('wa.me');
  }

  it('SL-W8 answers the 503 page when the registry is empty', async () => {
    await expectUnavailablePage({ response: await getStart({}), first: OwnerLocale.PortugueseBrazil });
  });

  it('SL-W9 answers the 503 page when no number is active', async () => {
    await seedStartNumber({
      numberId: 'num_closed',
      displayNumber: ACTIVE_DISPLAY_NUMBER,
      state: WhatsAppNumberState.Closed,
      createdAt: OLDEST,
    });
    await expectUnavailablePage({ response: await getStart({}), first: OwnerLocale.PortugueseBrazil });
  });

  it('SL-W10 puts the English copy first for lang=en', async () => {
    await expectUnavailablePage({ response: await getStart({ query: `?lang=${DocsPageLanguage.English}` }), first: OwnerLocale.EnglishUs });
  });

  it('SL-W11 answers the 503 page when the stored number fails the pattern', async () => {
    await seedStartNumber({ numberId: 'num_bad', displayNumber: 'not a number', state: WhatsAppNumberState.Active, createdAt: OLDEST });
    await expectUnavailablePage({ response: await getStart({}), first: OwnerLocale.PortugueseBrazil });
  });

  it('SL-W12 answers 500 without a redirect when the registry read fails', async () => {
    const lines = captureLogLines();
    await testEnv.CONNECTIONS.prepare(BREAK_DISPLAY_NUMBER_STATEMENT).run();
    const response = await getStart({});
    expect(response.status).toBe(500);
    expect(response.headers.get('location')).toBeNull();
    expect(await response.text()).toBe('server error');
    expect(lines.join('\n')).toContain('start_link.failed');
  });
});

describe('start link request handling', () => {
  it.each(['?lang=fr', '?lang=', '?lang=en&lang=en', '?lang=en&lang=pt-BR', '?lang=EN'])('SL-W13 answers 400 for %s', async (query) => {
    await seedActiveNumber();
    const response = await getStart({ query });
    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
    expect(await response.text()).toBe('bad request');
    expectPrivateHeaders({ headers: response.headers });
  });

  it('SL-W14 answers 400 without reading the registry when the client address header is missing', async () => {
    await testEnv.CONNECTIONS.prepare(BREAK_DISPLAY_NUMBER_STATEMENT).run();
    const response = await exports.default.fetch(new Request(`${ORIGIN}${START_LINK_PATH}`, { redirect: 'manual' }));
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('bad request');
    expectPrivateHeaders({ headers: response.headers });
  });

  it.each([
    ['POST', START_LINK_PATH],
    ['PUT', START_LINK_PATH],
    ['DELETE', START_LINK_PATH],
    ['GET', `${START_LINK_PATH}/`],
    ['GET', `${START_LINK_PATH}/extra`],
    ['GET', `${START_LINK_PATH}x`],
  ])('SL-W15 answers 404 for %s %s', async (method, path) => {
    await seedActiveNumber();
    const response = await getStart({ method, path });
    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
  });
});

describe('start link rate limit', () => {
  it(
    'SL-W16 answers 429 with Retry-After past the limit and leaves another address alone',
    async () => {
      await seedActiveNumber();
      await startInFreshWindow({ marginMs: FRESH_WINDOW_MARGIN_MS });
      const burst = await Promise.all(
        Array.from({ length: INSTALL_PAGE_REQUESTS_PER_MINUTE + 1 }, () => getStart({ address: LIMITED_ADDRESS })),
      );
      const limited = burst.filter((response) => response.status === 429);
      expect(burst.filter((response) => response.status === 302)).toHaveLength(INSTALL_PAGE_REQUESTS_PER_MINUTE);
      expect(limited).toHaveLength(1);
      expect(limited[0]?.headers.get('retry-after')).toBe(RETRY_AFTER_SECONDS);
      expect(await limited[0]?.text()).toBe('too many requests');
      expectPrivateHeaders({ headers: (limited[0] as Response).headers });
      expect((await getStart({ address: UNLIMITED_ADDRESS })).status).toBe(302);
    },
    FRESH_WINDOW_TEST_TIMEOUT_MS,
  );

  it(
    'SL-W17 keeps its counter apart from the install page',
    async () => {
      await seedActiveNumber();
      await startInFreshWindow({ marginMs: FRESH_WINDOW_MARGIN_MS });
      await Promise.all(Array.from({ length: INSTALL_PAGE_REQUESTS_PER_MINUTE + 1 }, () => getStart({ address: COUNTER_ADDRESS })));
      expect((await getStart({ address: COUNTER_ADDRESS })).status).toBe(429);
      const installPage = await exports.default.fetch(
        new Request(`${ORIGIN}${INSTALL_PAGE_PATH_PREFIX}zb_inst_${'A'.repeat(22)}`, {
          headers: { [CLIENT_ADDRESS_HEADER]: COUNTER_ADDRESS },
        }),
      );
      expect(installPage.status).toBe(404);
    },
    FRESH_WINDOW_TEST_TIMEOUT_MS,
  );
});

describe('start link hosts', () => {
  it.each([BACKOFFICE_ORIGIN, TRAILING_DOT_BACKOFFICE_ORIGIN])('SL-W18 answers 404 on the host %s', async (origin) => {
    await seedActiveNumber();
    const request = new Request(`${origin}${START_LINK_PATH}`, {
      headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS },
      redirect: 'manual',
    });
    const response = await production.fetch(request, env, createExecutionContext());
    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
  });
});
