import { reset } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { AGENT_RULES, RATE_LIMIT_PERIOD_MS, type InstallCodeDirectory } from '@zapbip/core';
import {
  AccountState,
  INSTALL_CODE_PREFIX,
  INSTALL_CODE_TTL_MS,
  INSTALL_PAGE_PATH_PREFIX,
  INSTALL_PAGE_REQUESTS_PER_MINUTE,
  INSTALL_SELF_TEST_TEXT,
  OwnerLocale,
  SECOND_MS,
  WakeMode,
} from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createConnectionSecrets } from '../../src/adapters/platform/connection-secrets';
import { CONNECTION_SECRET_PREFIX } from '../../src/contract/constants';
import { createInstallPageRoute, type WakeModeEntry } from '../../src/routes/install-page';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import { connectionRegistry, installCodeDirectory, issueInstallCodeColumns, registerWithInstallCode } from '../support/install-codes';
import { applyDirectoryMigration, seedOwnerIdentity } from '../support/seed';
import { testEnv } from '../support/workers-env';

const AGENT = 'claude';
const STANDBY_AGENT = 'Ana Bot';
const CLIENT_ADDRESS = '203.0.113.7';
const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip';
const ORIGIN = 'http://localhost:8787';
const CONNECTION_PATH_MARK = '/c/';
const ROTATED_AT = 1_800_000_000_000;
const PHONE_DIGITS = 9;
const SECOND_RATE_LIMIT_ADDRESS = '203.0.113.8';
const GONE_TEXT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'girar <nome>',
  [OwnerLocale.EnglishUs]: 'rotate <name>',
};

function randomInstallCode(): string {
  const bytes = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  return `${INSTALL_CODE_PREFIX}${bytes}`;
}

async function seedAccount(input: { locale: OwnerLocale }): Promise<string> {
  const accountId = `acc_${crypto.randomUUID()}`;
  const digits = Array.from(crypto.getRandomValues(new Uint8Array(PHONE_DIGITS)), (value) => String(value % 10)).join('');
  await seedOwnerIdentity({ accountId, phone: `5511${digits}`, ownerLocale: input.locale });
  return accountId;
}

function validExpiry(): number {
  return Date.now() + INSTALL_CODE_TTL_MS;
}

function buildRoute(input: {
  limiter?: ReturnType<typeof createFakeRateLimiter>;
  readWakeModes?: () => Promise<WakeModeEntry[]>;
  directory?: InstallCodeDirectory;
}) {
  const {
    limiter = createFakeRateLimiter({ limit: INSTALL_PAGE_REQUESTS_PER_MINUTE }),
    readWakeModes = async () => [],
    directory = installCodeDirectory(),
  } = input;
  return createInstallPageRoute({
    installCodeDirectory: directory,
    connectionRegistry: connectionRegistry(),
    readWakeModes,
    limiter,
  });
}

function getPage(input: { route: ReturnType<typeof buildRoute>; installCode: string; address?: string }): Promise<Response> {
  const { address = CLIENT_ADDRESS } = input;
  return Promise.resolve(
    input.route.request(`${INSTALL_PAGE_PATH_PREFIX}${input.installCode}`, { headers: { [CLIENT_ADDRESS_HEADER]: address } }),
  );
}

beforeEach(applyDirectoryMigration);
afterEach(reset);

describe.each([OwnerLocale.PortugueseBrazil, OwnerLocale.EnglishUs])('install page for %s', (locale) => {
  it('IS-W3 serves the Markdown page with the connection URL and the self-test text', async () => {
    const accountId = await seedAccount({ locale });
    const { installCode, secret } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    const response = await getPage({ route: buildRoute({}), installCode });
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^text\/markdown/);
    expect(body).toContain(`${testEnv.PUBLIC_ORIGIN}${CONNECTION_PATH_MARK}${secret}/mcp`);
    expect(body).toContain(INSTALL_SELF_TEST_TEXT[locale]);
  });

  it('IS-W8 answers 410 in the account locale after the first MCP call, without the connection URL', async () => {
    const accountId = await seedAccount({ locale });
    const { installCode, connection } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    const route = buildRoute({});
    expect((await getPage({ route, installCode })).status).toBe(200);
    await installCodeDirectory().recordFirstCall({ connectionId: connection.connectionId, calledAt: Date.now() });
    const response = await getPage({ route, installCode });
    const body = await response.text();
    expect(response.status).toBe(410);
    expect(body).toContain(GONE_TEXT[locale]);
    expect(body).not.toContain(CONNECTION_PATH_MARK);
  });
});

describe('install page lifecycle', () => {
  it('IS-W5b carries the agent rules verbatim', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const { installCode } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    expect(await (await getPage({ route: buildRoute({}), installCode })).text()).toContain(AGENT_RULES);
  });

  it('IS-W9 answers 410 for an expired code, without the link or the secret', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const { installCode } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: Date.now() - 1 });
    const response = await getPage({ route: buildRoute({}), installCode });
    const body = await response.text();
    expect(response.status).toBe(410);
    expect(body).not.toContain(CONNECTION_PATH_MARK);
    expect(body).not.toContain(CONNECTION_SECRET_PREFIX);
  });

  it('IS-W9b holds the link only within the lifetime', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const within = await registerWithInstallCode({ accountId, agent: 'within', expiresAt: Date.now() + SECOND_MS * 60 });
    const beyond = await registerWithInstallCode({ accountId, agent: 'beyond', expiresAt: Date.now() - SECOND_MS });
    const route = buildRoute({});
    const withinResponse = await getPage({ route, installCode: within.installCode });
    const beyondResponse = await getPage({ route, installCode: beyond.installCode });
    expect(withinResponse.status).toBe(200);
    expect(await withinResponse.text()).toContain(within.secret);
    expect(beyondResponse.status).toBe(410);
    expect(await beyondResponse.text()).not.toContain(beyond.secret);
  });

  it('IS-W10 answers 404 in plain text for an unknown code', async () => {
    const response = await getPage({ route: buildRoute({}), installCode: randomInstallCode() });
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toMatch(/^text\/plain/);
  });

  it('IS-W11 answers 429 with Retry-After on the request over the limit, and runs no lookup for it', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const { installCode } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    const directory = installCodeDirectory();
    const resolve = vi.spyOn(directory, 'resolve');
    const route = buildRoute({ directory, limiter: createFakeRateLimiter({ limit: INSTALL_PAGE_REQUESTS_PER_MINUTE }) });
    const responses = await Promise.all(
      Array.from({ length: INSTALL_PAGE_REQUESTS_PER_MINUTE + 1 }, () => getPage({ route, installCode })),
    );
    const limited = responses.at(-1);
    expect(responses.slice(0, INSTALL_PAGE_REQUESTS_PER_MINUTE).map((response) => response.status)).toEqual(
      Array(INSTALL_PAGE_REQUESTS_PER_MINUTE).fill(200),
    );
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get('retry-after')).toBe(String(RATE_LIMIT_PERIOD_MS / SECOND_MS));
    expect(resolve).toHaveBeenCalledTimes(INSTALL_PAGE_REQUESTS_PER_MINUTE);
  });

  it('IS-W11 keys the limit by client address', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const { installCode } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    const route = buildRoute({ limiter: createFakeRateLimiter({ limit: 1 }) });
    await getPage({ route, installCode });
    expect((await getPage({ route, installCode })).status).toBe(429);
    expect((await getPage({ route, installCode, address: SECOND_RATE_LIMIT_ADDRESS })).status).toBe(200);
  });

  it('IS-W12 picks the standby agent per request', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const { installCode } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    let wakeModes: WakeModeEntry[] = [{ agent: AGENT, wakeMode: WakeMode.None }];
    const route = buildRoute({ readWakeModes: async () => wakeModes });
    const before = await (await getPage({ route, installCode })).text();
    await registerWithInstallCode({ accountId, agent: STANDBY_AGENT, expiresAt: validExpiry() });
    wakeModes = [...wakeModes, { agent: STANDBY_AGENT, wakeMode: WakeMode.Webhook }];
    const after = await (await getPage({ route, installCode })).text();
    expect(before).not.toContain(`standby_agent: "${STANDBY_AGENT}"`);
    expect(after).toContain(`standby_agent: "${STANDBY_AGENT}"`);
  });

  it('IS-W13 answers 404 once the connection is revoked', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const { installCode } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    await connectionRegistry().revoke({ accountId, agent: AGENT, revokedAt: ROTATED_AT });
    expect((await getPage({ route: buildRoute({}), installCode })).status).toBe(404);
  });

  it('IS-W14 answers 404 for the old code and serves the new URL for the new code after a rotate', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const { installCode: oldCode, connection } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    const { secret, digest } = await createConnectionSecrets().issue();
    const { installCode: newCode, columns } = await issueInstallCodeColumns({ secret, expiresAt: validExpiry() });
    await connectionRegistry().rotate({
      accountId,
      agent: AGENT,
      fromDigest: connection.secretDigest,
      toDigest: digest,
      installCode: columns,
      rotatedAt: ROTATED_AT,
    });
    const route = buildRoute({});
    const newResponse = await getPage({ route, installCode: newCode });
    expect((await getPage({ route, installCode: oldCode })).status).toBe(404);
    expect(newResponse.status).toBe(200);
    expect(await newResponse.text()).toContain(`${CONNECTION_PATH_MARK}${secret}/mcp`);
  });

  it('IS-W15 answers 404 for a suspended account', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const { installCode } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    await testEnv.CONNECTIONS.prepare('UPDATE accounts SET state = ? WHERE id = ?').bind(AccountState.Suspended, accountId).run();
    expect((await getPage({ route: buildRoute({}), installCode })).status).toBe(404);
  });
});

describe('install page security', () => {
  it('IS-S2 sets no-store and noindex on every status', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const ready = await registerWithInstallCode({ accountId, agent: 'ready', expiresAt: validExpiry() });
    const expired = await registerWithInstallCode({ accountId, agent: 'expired', expiresAt: Date.now() - 1 });
    const route = buildRoute({});
    const limitedRoute = buildRoute({ limiter: createFakeRateLimiter({ limit: 0 }) });
    const responses = await Promise.all([
      getPage({ route, installCode: ready.installCode }),
      getPage({ route, installCode: expired.installCode }),
      getPage({ route, installCode: randomInstallCode() }),
      getPage({ route: limitedRoute, installCode: ready.installCode }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 410, 404, 429]);
    responses.forEach((response) => {
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(response.headers.get('x-robots-tag')).toBe('noindex');
    });
  });

  it('IS-S5 logs neither the install code nor the secret', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const { installCode, secret } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    const logged = vi.spyOn(console, 'log');
    const route = buildRoute({});
    await getPage({ route, installCode });
    await getPage({ route, installCode: randomInstallCode() });
    const output = logged.mock.calls.flat().join('\n');
    expect(output).not.toContain(installCode);
    expect(output).not.toContain(secret);
  });

  it('answers 400 when the client address is missing', async () => {
    const response = await buildRoute({}).request(`${INSTALL_PAGE_PATH_PREFIX}${randomInstallCode()}`);
    expect(response.status).toBe(400);
  });
});

describe('install page mount', () => {
  it('serves the route on the application with the limiter binding', async () => {
    const response = await exports.default.fetch(
      new Request(`${ORIGIN}${INSTALL_PAGE_PATH_PREFIX}${randomInstallCode()}`, { headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS } }),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
  });
});
