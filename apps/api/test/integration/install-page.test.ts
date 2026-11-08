import { reset } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { INSTALL_PAGE_SECTIONS } from '@zapbip/agents/install';
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
import { D1InstallCodeDirectory } from '../../src/adapters/d1/d1-install-code-directory';
import { createConnectionSecrets } from '../../src/adapters/platform/connection-secrets';
import { CONNECTION_SECRET_PREFIX } from '../../src/contract/constants';
import type { WakeModeEntry } from '../../src/contract/account-inbox-rpc';
import { createInstallPageRoute } from '../../src/routes/install-page';
import { createFakeRateLimiter } from '../support/fake-rate-limiter';
import { connectionRegistry, installCodeDirectory, issueInstallCodeColumns, registerWithInstallCode } from '../support/install-codes';
import { applyDirectoryMigration, seedOwnerIdentity } from '../support/seed';
import { testEnv } from '../support/workers-env';

const AGENT = 'claude';
const BROWSER_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0';
const SECURE_ORIGIN = 'https://api.test';
const INSECURE_ORIGIN = 'http://api.test';
const STANDBY_AGENT = 'Ana Bot';
const CLIENT_ADDRESS = '203.0.113.7';
const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip';
const ORIGIN = 'http://localhost:8787';
const CONNECTION_PATH_MARK = '/c/';
const ROTATED_AT = 1_800_000_000_000;
const PHONE_DIGITS = 9;
const SECOND_RATE_LIMIT_ADDRESS = '203.0.113.8';
declare global {
  interface ImportMeta {
    glob(pattern: string, options: { query: string; import: string; eager: true }): Record<string, string>;
  }
}

const SAMPLE_CONNECTION_LINK = 'https://x.example/c/zb_conn_FAKE/mcp';
const INSTALL_MARKDOWN_FILES = import.meta.glob('../../../../libs/agents/supported/*/install.*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const GONE_TEXT: Record<OwnerLocale, string> = {
  [OwnerLocale.PortugueseBrazil]: 'girar <nome>',
  [OwnerLocale.EnglishUs]: 'rotate <name>',
};

const LINK_PREVIEW_USER_AGENTS = [
  'WhatsApp/2.24.20.85 A',
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
  'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
  'Twitterbot/1.0',
  'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
  'TelegramBot (like TwitterBot)',
  'LinkedInBot/1.0 (compatible; Mozilla/5.0)',
  'Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5 skype-url-preview@microsoft.com',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0 Safari/537.36 Google-PageRenderer Google (+https://developers.google.com/+/web/snippet/)',
  'Iframely/1.3.1 (+https://iframely.com/docs/about)',
  'Mozilla/5.0 (compatible; Embedly/0.2; +http://support.embed.ly/)',
  'redditbot/1.0 (+http://www.reddit.com/feedback)',
  'Pinterestbot/1.0 (+http://www.pinterest.com/bot.html)',
  'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko vkShare; +http://vk.com/dev/Share',
  'http.rb/5.1.1 (Mastodon/4.2.0; +https://mastodon.social/)',
  'Bluesky Cardyb/1.1',
];

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
  requireSecureTransport?: boolean;
}) {
  const {
    limiter = createFakeRateLimiter({ limit: INSTALL_PAGE_REQUESTS_PER_MINUTE }),
    readWakeModes = async () => [],
    directory = installCodeDirectory(),
    requireSecureTransport = false,
  } = input;
  return createInstallPageRoute({
    installCodeDirectory: directory,
    connectionRegistry: connectionRegistry(),
    readWakeModes,
    limiter,
    requireSecureTransport,
  });
}

function getPage(input: {
  route: ReturnType<typeof buildRoute>;
  installCode: string;
  address?: string;
  userAgent?: string;
  origin?: string;
}): Promise<Response> {
  const { address = CLIENT_ADDRESS, userAgent = BROWSER_USER_AGENT, origin = '' } = input;
  return Promise.resolve(
    input.route.request(`${origin}${INSTALL_PAGE_PATH_PREFIX}${input.installCode}`, {
      headers: { [CLIENT_ADDRESS_HEADER]: address, 'user-agent': userAgent },
    }),
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

  it('serves the product sections in the registry order, the first one equal to its install file apart from the link', async () => {
    const accountId = await seedAccount({ locale });
    const { installCode, secret } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    const body = await (await getPage({ route: buildRoute({}), installCode })).text();
    const productNames = INSTALL_PAGE_SECTIONS.map((section) => section.productName);
    const headings = body.split('\n').filter((line) => line.startsWith('## '));
    expect(headings.filter((heading) => productNames.includes(heading.slice('## '.length)))).toEqual(
      productNames.map((productName) => `## ${productName}`),
    );
    const [first] = INSTALL_PAGE_SECTIONS;
    const firstFile = Object.entries(INSTALL_MARKDOWN_FILES).find(
      ([path, text]) => path.endsWith(`.${locale}.md`) && text.startsWith(`## ${first?.productName}\n`),
    );
    const connectionLink = `${testEnv.PUBLIC_ORIGIN}${CONNECTION_PATH_MARK}${secret}/mcp`;
    expect(firstFile?.[1].replaceAll(SAMPLE_CONNECTION_LINK, connectionLink)).toBeDefined();
    expect(body).toContain((firstFile?.[1] as string).replaceAll(SAMPLE_CONNECTION_LINK, connectionLink).trimEnd());
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

describe('install page link previews and transport', () => {
  it.each(LINK_PREVIEW_USER_AGENTS)('answers 404 to %s without consuming the code', async (userAgent) => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const { installCode, connection } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    const route = buildRoute({});
    const preview = await getPage({ route, installCode, userAgent });
    expect(preview.status).toBe(404);
    expect(await preview.text()).not.toContain(CONNECTION_PATH_MARK);
    const owner = await getPage({ route, installCode });
    expect(owner.status).toBe(200);
    expect(connection.connectionId).toBeTruthy();
  });

  it('sets the hardening headers on every status', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const ready = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    const route = buildRoute({});
    const responses = await Promise.all([
      getPage({ route, installCode: ready.installCode }),
      getPage({ route, installCode: randomInstallCode() }),
    ]);
    responses.forEach((response) => {
      expect(response.headers.get('referrer-policy')).toBe('no-referrer');
      expect(response.headers.get('x-content-type-options')).toBe('nosniff');
      expect(response.headers.get('strict-transport-security')).toMatch(/max-age=\d+/);
    });
  });

  it('answers 404 over plain http when secure transport is required, without resolving the code', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const { installCode } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    const route = buildRoute({ requireSecureTransport: true });
    const insecure = await getPage({ route, installCode, origin: INSECURE_ORIGIN });
    expect(insecure.status).toBe(404);
    expect(await insecure.text()).not.toContain(CONNECTION_PATH_MARK);
    const secure = await getPage({ route, installCode, origin: SECURE_ORIGIN });
    expect(secure.status).toBe(200);
  });

  it('serves plain http when secure transport is not required', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.EnglishUs });
    const { installCode } = await registerWithInstallCode({ accountId, agent: AGENT, expiresAt: validExpiry() });
    const response = await getPage({ route: buildRoute({}), installCode, origin: INSECURE_ORIGIN });
    expect(response.status).toBe(200);
  });
});

describe('install page brute force', () => {
  it('IS-S1 answers 404 for a malformed code without any lookup', async () => {
    const directory = installCodeDirectory();
    const resolve = vi.spyOn(directory, 'resolve');
    const route = buildRoute({ directory });
    const responses = await Promise.all(
      ['zb_inst_short', 'nope', `${INSTALL_CODE_PREFIX}${'a'.repeat(80)}`, 'zb_inst_%20%20%20%20%20%20%20%20%20%20%20%20'].map(
        (installCode) => getPage({ route, installCode }),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([404, 404, 404, 404]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('IS-S1 limits many random codes by client address and never resolves the limited ones', async () => {
    const directory = installCodeDirectory();
    const resolve = vi.spyOn(directory, 'resolve');
    const route = buildRoute({ directory, limiter: createFakeRateLimiter({ limit: INSTALL_PAGE_REQUESTS_PER_MINUTE }) });
    const attempts = INSTALL_PAGE_REQUESTS_PER_MINUTE * 3;
    const responses = await Promise.all(Array.from({ length: attempts }, () => getPage({ route, installCode: randomInstallCode() })));
    const limitedCount = responses.filter((response) => response.status === 429).length;
    expect(limitedCount).toBe(attempts - INSTALL_PAGE_REQUESTS_PER_MINUTE);
    expect(resolve).toHaveBeenCalledTimes(INSTALL_PAGE_REQUESTS_PER_MINUTE);
  });
});

describe('install page edges', () => {
  afterEach(() => vi.restoreAllMocks());

  const PRIVATE_HEADERS = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' };

  function expectPrivate(response: Response): void {
    Object.entries(PRIVATE_HEADERS).forEach(([name, value]) => expect(response.headers.get(name)).toBe(value));
  }

  it.each([
    { title: 'POST /i/<code>', path: `${INSTALL_PAGE_PATH_PREFIX}${randomInstallCode()}`, method: 'POST', status: 404 },
    { title: 'GET /i/', path: INSTALL_PAGE_PATH_PREFIX, method: 'GET', status: 404 },
    { title: 'GET /i/a/b', path: `${INSTALL_PAGE_PATH_PREFIX}a/b`, method: 'GET', status: 404 },
  ])('IS-S2 answers $title with no-store and noindex', async ({ path, method, status }) => {
    const response = await exports.default.fetch(
      new Request(`${ORIGIN}${path}`, { method, headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS } }),
    );
    expect(response.status).toBe(status);
    expectPrivate(response);
  });

  it('IS-S2 answers a directory error with no-store, noindex and no detail', async () => {
    vi.spyOn(D1InstallCodeDirectory.prototype, 'resolve').mockRejectedValue(new Error('D1_ERROR secret detail'));
    const response = await exports.default.fetch(
      new Request(`${ORIGIN}${INSTALL_PAGE_PATH_PREFIX}${randomInstallCode()}`, { headers: { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS } }),
    );
    expect(response.status).toBe(500);
    expectPrivate(response);
    expect(await response.text()).not.toContain('secret detail');
  });

  it('IS-S1 keys an IPv6 client by its /64 prefix', async () => {
    const limiter = createFakeRateLimiter({ limit: INSTALL_PAGE_REQUESTS_PER_MINUTE });
    const route = buildRoute({ limiter });
    const code = randomInstallCode();
    await getPage({ route, installCode: code, address: '2001:db8:1:2:aaaa:bbbb:cccc:dddd' });
    await getPage({ route, installCode: code, address: '2001:db8:1:2:1111:2222:3333:4444' });
    await getPage({ route, installCode: code, address: '2001:db8:1:3::1' });
    expect(limiter.calls[0]).toBe(limiter.calls[1]);
    expect(limiter.calls[2]).not.toBe(limiter.calls[0]);
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
