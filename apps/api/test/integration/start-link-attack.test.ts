import { reset } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { OwnerLocale, START_LINK_PATH, START_PREFILLED_TEXT, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyDirectoryMigration } from '../support/seed';
import { seedStartNumber } from '../support/start-link-numbers';

const ORIGIN = 'http://localhost:8787';
const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip';
const CLIENT_ADDRESS = '203.0.113.30';
const DISPLAY_NUMBER = '+5511977770003';
const EXPECTED_TARGET = `https://wa.me/5511977770003?text=${encodeURIComponent(START_PREFILLED_TEXT[OwnerLocale.PortugueseBrazil])}`;
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

function getStart(input: { query: string; headers?: Record<string, string> }): Promise<Response> {
  const { headers = {} } = input;
  return exports.default.fetch(
    new Request(`${ORIGIN}${START_LINK_PATH}${input.query}`, {
      headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS, ...headers },
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
    const lines: string[] = [];
    (['log', 'info', 'warn', 'error', 'debug'] as const).forEach((method) =>
      vi.spyOn(console, method).mockImplementation((...parts: unknown[]) => void lines.push(parts.join(' '))),
    );
    const response = await getStart({ query: '' });
    expect(response.status).toBe(503);
    expect(lines.join('\n')).toContain('start_link.invalid_number');
    expect(lines.join('\n')).not.toMatch(/5511|wa\.me|203\.0\.113/);
  });
});
