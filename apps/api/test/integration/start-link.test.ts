import { reset } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import {
  DocsLanguage,
  INSTALL_PAGE_PATH_PREFIX,
  INSTALL_PAGE_REQUESTS_PER_MINUTE,
  OwnerLocale,
  START_LINK_PATH,
  START_PREFILLED_TEXT,
  WhatsAppNumberState,
} from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { START_LINK_COPY } from '../../src/routes/start-link-copy';
import { applyDirectoryMigration } from '../support/seed';
import { changeStartNumberState, seedStartNumber } from '../support/start-link-numbers';
import { testEnv } from '../support/workers-env';

const ORIGIN = 'http://localhost:8787';
const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip';
const CLIENT_ADDRESS = '203.0.113.20';
const OTHER_CLIENT_ADDRESS = '203.0.113.21';
const OLDEST = 1_700_000_000_000;
const NEWER = OLDEST + 1_000;
const RETRY_AFTER_SECONDS = '60';
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

async function seedActiveNumber(): Promise<void> {
  await seedStartNumber({ numberId: 'num_a', displayNumber: ACTIVE_DISPLAY_NUMBER, state: WhatsAppNumberState.Active, createdAt: OLDEST });
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('start link redirect', () => {
  it('SL-W1 redirects to the wa.me link of the active number with the default locale text', async () => {
    await seedActiveNumber();
    const response = await getStart({});
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(targetOf({ digits: ACTIVE_DIGITS, locale: OwnerLocale.PortugueseBrazil }));
  });

  it.each([
    [DocsLanguage.English, OwnerLocale.EnglishUs],
    [DocsLanguage.PortugueseBrazil, OwnerLocale.PortugueseBrazil],
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
    const { headers } = await getStart({});
    expect(headers.get('cache-control')).toBe('no-store');
    expect(headers.get('x-robots-tag')).toBe('noindex');
    expect(headers.get('referrer-policy')).toBe('no-referrer');
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('strict-transport-security')).toMatch(/^max-age=\d+/);
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

describe('start link without a usable number', () => {
  async function expectUnavailablePage(input: { response: Response; first: OwnerLocale }): Promise<void> {
    const { response, first } = input;
    const body = await response.text();
    const second = Object.values(OwnerLocale).find((locale) => locale !== first) as OwnerLocale;
    expect(response.status).toBe(503);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('retry-after')).toBe(RETRY_AFTER_SECONDS);
    expect(response.headers.get('content-type')).toMatch(/^text\/html/);
    expect(response.headers.get('content-security-policy')).toBe("default-src 'none'");
    expect(response.headers.get('cache-control')).toBe('no-store');
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
    await expectUnavailablePage({ response: await getStart({ query: `?lang=${DocsLanguage.English}` }), first: OwnerLocale.EnglishUs });
  });

  it('SL-W11 answers the 503 page when the stored number fails the pattern', async () => {
    await seedStartNumber({ numberId: 'num_bad', displayNumber: 'not a number', state: WhatsAppNumberState.Active, createdAt: OLDEST });
    await expectUnavailablePage({ response: await getStart({}), first: OwnerLocale.PortugueseBrazil });
  });

  it('SL-W12 answers 500 without a redirect when the registry read fails', async () => {
    await testEnv.CONNECTIONS.prepare(BREAK_DISPLAY_NUMBER_STATEMENT).run();
    const response = await getStart({});
    expect(response.status).toBe(500);
    expect(response.headers.get('location')).toBeNull();
    expect(await response.text()).toBe('server error');
  });
});

describe('start link request handling', () => {
  it.each(['?lang=fr', '?lang=', '?lang=en&lang=en', '?lang=en&lang=pt-BR', '?lang=EN'])('SL-W13 answers 400 for %s', async (query) => {
    await seedActiveNumber();
    const response = await getStart({ query });
    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
    expect(await response.text()).toBe('bad request');
  });

  it('SL-W14 answers 400 when the client address header is missing', async () => {
    await seedActiveNumber();
    const response = await exports.default.fetch(new Request(`${ORIGIN}${START_LINK_PATH}`, { redirect: 'manual' }));
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('bad request');
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
  it('SL-W16 answers 429 with Retry-After past the limit and leaves another address alone', async () => {
    await seedActiveNumber();
    const allowed = await Promise.all(Array.from({ length: INSTALL_PAGE_REQUESTS_PER_MINUTE }, () => getStart({})));
    expect(allowed.map((response) => response.status)).toEqual(Array(INSTALL_PAGE_REQUESTS_PER_MINUTE).fill(302));
    const limited = await getStart({});
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe(RETRY_AFTER_SECONDS);
    expect(await limited.text()).toBe('too many requests');
    expect((await getStart({ address: OTHER_CLIENT_ADDRESS })).status).toBe(302);
  });

  it('SL-W17 keeps its counter apart from the install page', async () => {
    await seedActiveNumber();
    await Promise.all(Array.from({ length: INSTALL_PAGE_REQUESTS_PER_MINUTE + 1 }, () => getStart({})));
    expect((await getStart({})).status).toBe(429);
    const installPage = await exports.default.fetch(
      new Request(`${ORIGIN}${INSTALL_PAGE_PATH_PREFIX}zb_inst_${'A'.repeat(22)}`, {
        headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS },
      }),
    );
    expect(installPage.status).toBe(404);
  });
});
