import { reset } from 'cloudflare:test';
import { RATE_LIMIT_PERIOD_MS } from '@zapbip/core';
import { INSTALL_CODE_TTL_MS, INSTALL_PAGE_PATH_PREFIX, INSTALL_PAGE_REQUESTS_PER_MINUTE, OwnerLocale, SECOND_MS } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInstallPageRoute } from '../../src/routes/install-page';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import { connectionRegistry, installCodeDirectory, registerWithInstallCode } from '../support/install-codes';
import { applyDirectoryMigration, seedOwnerIdentity } from '../support/seed';

const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip';
const CLIENT_ADDRESS = '203.0.113.7';
const UNKNOWN_INSTALL_CODE = 'zb_install_AAAAAAAAAAAAAAAAAAAAAA';
const OWNER_PHONE = '5511999990001';
const AGENT = 'claude';
const PRIVATE_HEADERS = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'strict-transport-security': 'max-age=63072000; includeSubDomains',
};
const MARKDOWN_HEADERS = { ...PRIVATE_HEADERS, 'content-type': 'text/markdown; charset=utf-8' };
const PLAIN_HEADERS = { ...PRIVATE_HEADERS, 'content-type': 'text/plain; charset=utf-8' };

function buildRoute(input: { limit: number }) {
  return createInstallPageRoute({
    installCodeDirectory: installCodeDirectory(),
    connectionRegistry: connectionRegistry(),
    readWakeModes: async () => [],
    limiter: createFakeRateLimiter({ limit: input.limit }),
    requireSecureTransport: false,
  });
}

function getPage(input: { route: ReturnType<typeof buildRoute>; installCode: string; withAddress?: boolean }): Promise<Response> {
  const { withAddress = true } = input;
  const headers: Record<string, string> = withAddress ? { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS } : {};
  return Promise.resolve(input.route.request(`${INSTALL_PAGE_PATH_PREFIX}${input.installCode}`, { headers }));
}

function headersOf(response: Response): Record<string, string> {
  return Object.fromEntries(response.headers.entries());
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe('pin: the install page answers with the headers it had before the shared private response', () => {
  it('serves 200 with the Markdown content type and the private headers, and nothing else', async () => {
    await seedOwnerIdentity({ accountId: 'acc_headers', phone: OWNER_PHONE, ownerLocale: OwnerLocale.EnglishUs });
    const { installCode } = await registerWithInstallCode({
      accountId: 'acc_headers',
      agent: AGENT,
      expiresAt: Date.now() + INSTALL_CODE_TTL_MS,
    });
    const response = await getPage({ route: buildRoute({ limit: INSTALL_PAGE_REQUESTS_PER_MINUTE }), installCode });
    expect(response.status).toBe(200);
    expect(headersOf(response)).toEqual(MARKDOWN_HEADERS);
  });

  it('serves 410 for an expired code with the plain content type and the private headers', async () => {
    await seedOwnerIdentity({ accountId: 'acc_headers', phone: OWNER_PHONE, ownerLocale: OwnerLocale.EnglishUs });
    const { installCode } = await registerWithInstallCode({ accountId: 'acc_headers', agent: AGENT, expiresAt: Date.now() - 1 });
    const response = await getPage({ route: buildRoute({ limit: INSTALL_PAGE_REQUESTS_PER_MINUTE }), installCode });
    expect(response.status).toBe(410);
    expect(headersOf(response)).toEqual(PLAIN_HEADERS);
  });

  it('serves 404 for an unknown code with the plain content type and the private headers', async () => {
    const response = await getPage({ route: buildRoute({ limit: INSTALL_PAGE_REQUESTS_PER_MINUTE }), installCode: UNKNOWN_INSTALL_CODE });
    expect(response.status).toBe(404);
    expect(headersOf(response)).toEqual(PLAIN_HEADERS);
  });

  it('serves 429 with Retry-After on top of the plain content type and the private headers', async () => {
    const response = await getPage({ route: buildRoute({ limit: 0 }), installCode: UNKNOWN_INSTALL_CODE });
    expect(response.status).toBe(429);
    expect(headersOf(response)).toEqual({ ...PLAIN_HEADERS, 'retry-after': String(RATE_LIMIT_PERIOD_MS / SECOND_MS) });
  });

  it('serves 400 without a client address with the plain content type and the private headers', async () => {
    const response = await getPage({
      route: buildRoute({ limit: INSTALL_PAGE_REQUESTS_PER_MINUTE }),
      installCode: UNKNOWN_INSTALL_CODE,
      withAddress: false,
    });
    expect(response.status).toBe(400);
    expect(headersOf(response)).toEqual(PLAIN_HEADERS);
  });
});
