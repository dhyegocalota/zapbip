import { reset } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import {
  INSTALL_PAGE_REQUESTS_PER_MINUTE,
  OwnerLocale,
  START_LINK_PATH,
  START_PREFILLED_TEXT,
  WHATSAPP_LINK_ORIGIN,
  WhatsAppNumberState,
} from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyDirectoryMigration } from '../support/seed';
import { captureLogLines } from '../support/capture-log-lines';
import { seedStartNumber } from '../support/start-link-numbers';
import { testEnv } from '../support/workers-env';

const ORIGIN = 'http://localhost:8787';
const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip';
const CLIENT_ADDRESS = '203.0.113.30';
const LOGGED_ADDRESS = '203.0.113.31';
const ENUMERATION_REQUEST_COUNT = 100;
const BREAK_DISPLAY_NUMBER_STATEMENT = 'ALTER TABLE whatsapp_numbers RENAME COLUMN display_number TO moved_display_number';
const LEAKED_VALUE_PATTERN = /5511|wa\.me|203\.0\.113|phone-num|waba-num/;
const DISPLAY_NUMBER = '+5511977770003';
const EXPECTED_TARGET = `https://wa.me/5511977770003?text=${encodeURIComponent(START_PREFILLED_TEXT[OwnerLocale.EnglishUs])}`;
const OPEN_REDIRECT_QUERIES = [
  '?text=free+text',
  '?next=https://evil.example',
  '?redirect=//evil.example',
  '?url=https%3A%2F%2Fevil.example',
  '?to=//evil.example&number=5511000000000',
  '?phone=5511000000000',
  '?foo=bar&foo=baz',
  '?__proto__=x&constructor=y',
];
const REJECTED_LANGUAGE_QUERIES = [
  '?lang=en%0d%0aLocation:%20https://evil.example',
  '?lang=https://evil.example',
  '?lang=//evil.example',
  '?lang=en%00',
  '?lang=__proto__',
];

function getStart(input: { query: string; path?: string; address?: string; headers?: Record<string, string> }): Promise<Response> {
  const { headers = {}, path = START_LINK_PATH, address = CLIENT_ADDRESS } = input;
  return exports.default.fetch(
    new Request(`${ORIGIN}${path}${input.query}`, {
      headers: { [CLIENT_ADDRESS_HEADER]: address, ...headers },
      redirect: 'manual',
    }),
  );
}

beforeEach(async () => {
  await applyDirectoryMigration();
  await seedStartNumber({ numberId: 'num_a', displayNumber: DISPLAY_NUMBER, state: WhatsAppNumberState.Active, createdAt: 1 });
});

afterEach(() => {
  vi.restoreAllMocks();
  return reset();
});

describe('start link attacks', () => {
  it.each(OPEN_REDIRECT_QUERIES)('SL-S1 never copies %s into the redirect target', async (query) => {
    const response = await getStart({ query });
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(EXPECTED_TARGET);
  });

  it.each(REJECTED_LANGUAGE_QUERIES)('SL-S2 answers 400 without a Location for %s', async (query) => {
    const response = await getStart({ query });
    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
  });

  it.each<Record<string, string>>([
    { host: 'evil.example' },
    { 'x-forwarded-host': 'evil.example' },
    { 'x-forwarded-proto': 'http' },
    { referer: 'https://evil.example/' },
    { origin: 'https://evil.example' },
  ])('SL-S3 ignores the request header %j when building the target', async (headers) => {
    const response = await getStart({ query: '', headers });
    expect(response.headers.get('location')).toBe(EXPECTED_TARGET);
  });

  it('SL-S4 logs no number, address or target when the stored number is invalid', async () => {
    await seedStartNumber({ numberId: 'num_old', displayNumber: '5511999999999/../x', state: WhatsAppNumberState.Active, createdAt: 0 });
    const lines = captureLogLines();
    const response = await getStart({ query: '' });
    expect(response.status).toBe(503);
    expect(lines.join('\n')).toContain('start_link.invalid_number');
    expect(lines.join('\n')).not.toMatch(LEAKED_VALUE_PATTERN);
  });

  it.each([
    ['a redirect', async () => getStart({ query: '' })],
    ['a rejected language', async () => getStart({ query: '?lang=fr' })],
    ['a missing client address', async () => exports.default.fetch(new Request(`${ORIGIN}${START_LINK_PATH}`, { redirect: 'manual' }))],
    ['an unknown path', async () => getStart({ query: '', path: `${START_LINK_PATH}/extra` })],
    [
      'a rate limited client',
      async () => {
        await Promise.all(Array.from({ length: INSTALL_PAGE_REQUESTS_PER_MINUTE }, () => getStart({ query: '', address: LOGGED_ADDRESS })));
        return getStart({ query: '', address: LOGGED_ADDRESS });
      },
    ],
    [
      'an empty registry',
      async () => {
        await testEnv.CONNECTIONS.prepare('DELETE FROM whatsapp_numbers').run();
        return getStart({ query: '' });
      },
    ],
    [
      'a failing registry read',
      async () => {
        await testEnv.CONNECTIONS.prepare(BREAK_DISPLAY_NUMBER_STATEMENT).run();
        return getStart({ query: '' });
      },
    ],
  ])('SL-S5 logs no number, identifier, target or address on %s', async (_name, request) => {
    const lines = captureLogLines();
    await request();
    expect(lines.join('\n')).not.toMatch(LEAKED_VALUE_PATTERN);
  });

  it('SL-S6 answers the oldest of three active numbers to a hundred requests with varied queries', async () => {
    await seedStartNumber({ numberId: 'num_b', displayNumber: '+5511977770004', state: WhatsAppNumberState.Active, createdAt: 2 });
    await seedStartNumber({ numberId: 'num_c', displayNumber: '+5511977770005', state: WhatsAppNumberState.Active, createdAt: 3 });
    const responses = await Promise.all(
      Array.from({ length: ENUMERATION_REQUEST_COUNT }, (_value, index) =>
        getStart({
          query: `?lang=${index % 2 === 0 ? 'en' : 'pt-BR'}&probe=${index}&n=${index * 7}`,
          headers: { 'cf-connecting-ip': `203.0.114.${index}` },
        }),
      ),
    );
    const targets = responses.map((response) => response.headers.get('location'));
    expect(new Set(responses.map((response) => response.status))).toEqual(new Set([302]));
    expect(targets.every((target) => target?.startsWith(`${WHATSAPP_LINK_ORIGIN}/5511977770003?`))).toBe(true);
    expect((await Promise.all(responses.map((response) => response.text()))).join('')).toBe('');
  });
});
