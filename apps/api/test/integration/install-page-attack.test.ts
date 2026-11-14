import { reset, runInDurableObject } from 'cloudflare:test';
import { exports } from 'cloudflare:workers';
import { INSTALL_CODE_PREFIX, INSTALL_CODE_TTL_MS, INSTALL_PAGE_PATH_PREFIX, OwnerLocale, WakeMode } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_INBOX_MIGRATIONS } from '../../src/account-inbox/migrations';
import { runMigrations } from '../../src/account-inbox/run-migrations';
import { registerWithInstallCode } from '../support/install-codes';
import { startInFreshWindow } from '../support/rate-limit-window';
import { applyDirectoryMigration, seedOwnerIdentity } from '../support/seed';
import { accountInboxStub, testEnv } from '../support/workers-env';
import { MCP_REQUEST_HEADERS } from './mcp-fixtures';

const ORIGIN = 'http://localhost:8787';
const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip';
const DEFAULT_ADDRESS = '203.0.113.50';
const LIMITED_ADDRESS = '198.51.100.7';
const OTHER_ADDRESS = '198.51.100.8';
const CONNECTION_SECRET_PATTERN = /\/c\/(zb_conn_[A-Za-z0-9_-]+)\/mcp/;
const RANDOM_BODY_LENGTH = 22;
const CLIENT_NAME_MAXIMUM = 128;
const OVER_LIMIT_REQUESTS = 33;
const CONCURRENT_CALLS = 5;
const RETRY_AFTER_SECONDS = '60';
const FRESH_WINDOW_MARGIN_MS = 10_000;
const FRESH_WINDOW_TEST_TIMEOUT_MS = 90_000;
const INSERT_WAKE = 'INSERT INTO agent_wake (agent, mode, last_polled_at, updated_at) VALUES (?, ?, 0, 0)';
const SELECT_CONNECTION =
  'SELECT client_name AS clientName, first_call_at AS firstCallAt, install_code_sealed_secret AS sealedSecret FROM connections WHERE secret_digest = ?';

type ConnectionRow = { clientName: string | null; firstCallAt: number | null; sealedSecret: string | null };

function initializeBody(clientName: string): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: clientName, version: '1' } },
  });
}

function validExpiry(): number {
  return Date.now() + INSTALL_CODE_TTL_MS;
}

function randomCode(): string {
  return `${INSTALL_CODE_PREFIX}${'A'.repeat(RANDOM_BODY_LENGTH)}`;
}

async function seedAccount(input: { locale?: OwnerLocale }): Promise<string> {
  const { locale = OwnerLocale.EnglishUs } = input;
  const accountId = `acc_${crypto.randomUUID()}`;
  await seedOwnerIdentity({ accountId, phone: `5511${Math.floor(Math.random() * 1e9)}`, ownerLocale: locale });
  return accountId;
}

function getPage(input: { installCode: string; address?: string; method?: string }): Promise<Response> {
  const { address = DEFAULT_ADDRESS, method = 'GET' } = input;
  return exports.default.fetch(
    new Request(`${ORIGIN}${INSTALL_PAGE_PATH_PREFIX}${input.installCode}`, { method, headers: { [CLIENT_ADDRESS_HEADER]: address } }),
  );
}

function postMcp(input: { path: string; body: string; headers?: Record<string, string> }): Promise<Response> {
  const { headers = MCP_REQUEST_HEADERS } = input;
  return exports.default.fetch(new Request(`${ORIGIN}${input.path}`, { method: 'POST', headers, body: input.body }));
}

async function readConnection(input: { secretDigest: string }): Promise<ConnectionRow> {
  const row = await testEnv.CONNECTIONS.prepare(SELECT_CONNECTION).bind(input.secretDigest).first<ConnectionRow>();
  if (row === null) throw new Error('connection row missing');
  return row;
}

async function waitForFirstCall(input: { secretDigest: string }): Promise<void> {
  await vi.waitFor(async () => expect((await readConnection(input)).firstCallAt).not.toBeNull());
}

async function seedWakeMode(input: { accountId: string; agent: string; mode: WakeMode }): Promise<void> {
  await runInDurableObject(accountInboxStub({ accountId: input.accountId }), async (_instance, state) => {
    runMigrations({ storage: state.storage, migrations: ACCOUNT_INBOX_MIGRATIONS });
    state.storage.sql.exec(INSERT_WAKE, input.agent, input.mode);
  });
}

beforeEach(applyDirectoryMigration);
afterEach(() => {
  vi.restoreAllMocks();
  return reset();
});

describe('install page attacks', () => {
  it('IS-S1 serves the same page twice, then the first MCP call kills the sealed secret while the secret keeps working', async () => {
    const accountId = await seedAccount({});
    const { installCode, secret, connection } = await registerWithInstallCode({ accountId, agent: 'claude', expiresAt: validExpiry() });
    const first = await (await getPage({ installCode })).text();
    const second = await (await getPage({ installCode })).text();
    expect(first).toBe(second);
    expect(first.match(CONNECTION_SECRET_PATTERN)?.[1]).toBe(secret);
    expect((await postMcp({ path: `/c/${secret}/mcp`, body: initializeBody('Client One') })).status).toBe(200);
    await waitForFirstCall({ secretDigest: connection.secretDigest });
    expect((await readConnection({ secretDigest: connection.secretDigest })).sealedSecret).toBeNull();
    const gone = await getPage({ installCode });
    expect(gone.status).toBe(410);
    expect(await gone.text()).not.toContain(secret);
    expect((await postMcp({ path: `/c/${secret}/mcp`, body: initializeBody('again') })).status).toBe(200);
  });

  it('IS-S1 leaves the page ready after rejected or read-only MCP requests', async () => {
    const accountId = await seedAccount({});
    const { installCode, secret, connection } = await registerWithInstallCode({ accountId, agent: 'claude', expiresAt: validExpiry() });
    const bearer = (token: string) => ({ ...MCP_REQUEST_HEADERS, authorization: `Bearer ${token}` });
    const rejected = await Promise.all([
      postMcp({ path: `/c/${installCode}/mcp`, body: initializeBody('a') }),
      postMcp({ path: `/c/${secret}x/mcp`, body: initializeBody('a') }),
      postMcp({ path: '/mcp', body: initializeBody('a'), headers: bearer(installCode) }),
      postMcp({ path: '/mcp', body: initializeBody('a'), headers: bearer(`${secret}x`) }),
    ]);
    expect(rejected.map((response) => response.status)).toEqual([401, 401, 401, 401]);
    const get = await exports.default.fetch(
      new Request(`${ORIGIN}/c/${secret}/mcp`, { method: 'GET', headers: { accept: 'text/event-stream' } }),
    );
    const remove = await exports.default.fetch(new Request(`${ORIGIN}/c/${secret}/mcp`, { method: 'DELETE' }));
    await get.body?.cancel();
    await remove.body?.cancel();
    expect((await readConnection({ secretDigest: connection.secretDigest })).firstCallAt).toBeNull();
    expect((await getPage({ installCode })).status).toBe(200);
  });

  it('IS-S1 expires the page after a first call made on the Bearer route and records the client name', async () => {
    const accountId = await seedAccount({});
    const { installCode, secret, connection } = await registerWithInstallCode({ accountId, agent: 'claude', expiresAt: validExpiry() });
    const response = await postMcp({
      path: '/mcp',
      body: initializeBody('Client Two'),
      headers: { ...MCP_REQUEST_HEADERS, authorization: `Bearer ${secret}` },
    });
    expect(response.status).toBe(200);
    await vi.waitFor(async () => expect((await readConnection({ secretDigest: connection.secretDigest })).clientName).toBe('Client Two'));
    expect((await getPage({ installCode })).status).toBe(410);
  });

  it('IS-S1 answers 404 for near-miss codes and 200 only for the exact code', async () => {
    const accountId = await seedAccount({});
    const { installCode } = await registerWithInstallCode({ accountId, agent: 'claude', expiresAt: validExpiry() });
    const lastCharacter = installCode.endsWith('A') ? 'B' : 'A';
    const statuses = await Promise.all([
      getPage({ installCode: `${installCode.slice(0, -1)}${lastCharacter}`, address: '203.0.113.60' }),
      getPage({ installCode: `${installCode}a`, address: '203.0.113.61' }),
      getPage({ installCode: installCode.slice(INSTALL_CODE_PREFIX.length), address: '203.0.113.62' }),
      getPage({ installCode: installCode.replace(INSTALL_CODE_PREFIX, INSTALL_CODE_PREFIX.toUpperCase()), address: '203.0.113.63' }),
      getPage({ installCode: "zb_inst_' OR 1=1 --", address: '203.0.113.64' }),
      getPage({ installCode, address: '203.0.113.65', method: 'POST' }),
    ]);
    expect(statuses.map((response) => response.status)).toEqual([404, 404, 404, 404, 404, 404]);
    expect((await getPage({ installCode })).status).toBe(200);
  });

  it('IS-S5 logs neither the codes, the secret, the digests nor the sealed secret across page and MCP traffic', async () => {
    const accountId = await seedAccount({});
    const registered = await registerWithInstallCode({ accountId, agent: 'claude', expiresAt: validExpiry() });
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) => vi.spyOn(console, method));
    await getPage({ installCode: registered.installCode });
    await getPage({ installCode: randomCode() });
    await postMcp({ path: `/c/${registered.secret}/mcp`, body: initializeBody('Client One') });
    await postMcp({ path: `/c/${registered.installCode}/mcp`, body: initializeBody('Client One') });
    await waitForFirstCall({ secretDigest: registered.connection.secretDigest });
    await Promise.all(
      Array.from({ length: OVER_LIMIT_REQUESTS }, () => getPage({ installCode: registered.installCode, address: '203.0.113.99' })),
    );
    const output = spies
      .flatMap((spy) => spy.mock.calls.flat())
      .map(String)
      .join('\n');
    const forbidden = [
      registered.installCode,
      registered.secret,
      registered.connection.secretDigest,
      registered.connection.installCodeDigest,
      registered.connection.installCodeSealedSecret,
    ];
    forbidden.forEach((value) => expect(output).not.toContain(String(value)));
  });

  it('IS-S3 never names an agent of another account as standby', async () => {
    const accountA = await seedAccount({});
    const accountB = await seedAccount({});
    const registered = await registerWithInstallCode({ accountId: accountA, agent: 'claude', expiresAt: validExpiry() });
    await registerWithInstallCode({ accountId: accountB, agent: 'SecretBobBot', expiresAt: validExpiry() });
    await seedWakeMode({ accountId: accountB, agent: 'SecretBobBot', mode: WakeMode.Webhook });
    const text = await (await getPage({ installCode: registered.installCode })).text();
    expect(text).not.toContain('SecretBobBot');
    expect(text).not.toContain('standby_agent');
  });

  it('IS-S3 does not use the wake of a same-named agent in another account', async () => {
    const accountA = await seedAccount({});
    const accountB = await seedAccount({});
    const registered = await registerWithInstallCode({ accountId: accountA, agent: 'claude', expiresAt: validExpiry() });
    await registerWithInstallCode({ accountId: accountA, agent: 'Ana', expiresAt: validExpiry() });
    await seedWakeMode({ accountId: accountB, agent: 'Ana', mode: WakeMode.Webhook });
    expect(await (await getPage({ installCode: registered.installCode })).text()).not.toContain('standby_agent');
  });

  it('IS-W12 tells a local agent from a webhook agent by its webhook wake', async () => {
    const accountId = await seedAccount({});
    const registered = await registerWithInstallCode({ accountId, agent: 'claude', expiresAt: validExpiry() });
    await registerWithInstallCode({ accountId, agent: 'agent-three', expiresAt: validExpiry() });
    await registerWithInstallCode({ accountId, agent: 'grokbot', expiresAt: validExpiry() });
    await seedWakeMode({ accountId, agent: 'agent-three', mode: WakeMode.None });
    await seedWakeMode({ accountId, agent: 'grokbot', mode: WakeMode.Webhook });
    const text = await (await getPage({ installCode: registered.installCode })).text();
    expect(text).toContain('standby_agent: "grokbot"');
    expect(text).not.toContain('"agent-three"');
  });

  it(
    'IS-S1 limits the real binding per client address and answers Retry-After',
    async () => {
      await startInFreshWindow({ marginMs: FRESH_WINDOW_MARGIN_MS });
      const burst = await Promise.all(
        Array.from({ length: OVER_LIMIT_REQUESTS }, () => getPage({ installCode: randomCode(), address: LIMITED_ADDRESS })),
      );
      expect(burst.filter((response) => response.status === 429).length).toBeGreaterThan(0);
      expect((await getPage({ installCode: randomCode(), address: OTHER_ADDRESS })).status).toBe(404);
      const limited = await getPage({ installCode: randomCode(), address: LIMITED_ADDRESS });
      expect(limited.status).toBe(429);
      expect(limited.headers.get('retry-after')).toBe(RETRY_AFTER_SECONDS);
    },
    FRESH_WINDOW_TEST_TIMEOUT_MS,
  );

  it('IS-S1 answers 400 without the client address header, even for a valid code, and shows no secret', async () => {
    const accountId = await seedAccount({});
    const registered = await registerWithInstallCode({ accountId, agent: 'claude', expiresAt: validExpiry() });
    const response = await exports.default.fetch(new Request(`${ORIGIN}${INSTALL_PAGE_PATH_PREFIX}${registered.installCode}`));
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain(registered.secret);
  });

  it('IS-S4 records a client name of 128 characters, ignores 129 and still stamps the first call', async () => {
    const accountId = await seedAccount({});
    const cases = [
      { label: 'n128', body: initializeBody('x'.repeat(CLIENT_NAME_MAXIMUM)), expected: 'x'.repeat(CLIENT_NAME_MAXIMUM) },
      { label: 'n129', body: initializeBody('x'.repeat(CLIENT_NAME_MAXIMUM + 1)), expected: null },
    ];
    const recorded = await Promise.all(
      cases.map(async (testCase) => {
        const registered = await registerWithInstallCode({ accountId, agent: `agent_${testCase.label}`, expiresAt: validExpiry() });
        const response = await postMcp({ path: `/c/${registered.secret}/mcp`, body: testCase.body });
        await response.text();
        await waitForFirstCall({ secretDigest: registered.connection.secretDigest });
        return (await readConnection({ secretDigest: registered.connection.secretDigest })).clientName;
      }),
    );
    expect(recorded).toEqual(cases.map((testCase) => testCase.expected));
  });

  it('IS-S4 survives concurrent first calls and concurrent page reads with one recorded name', async () => {
    const accountId = await seedAccount({});
    const registered = await registerWithInstallCode({ accountId, agent: 'claude', expiresAt: validExpiry() });
    const results = await Promise.all([
      ...Array.from({ length: CONCURRENT_CALLS }, () =>
        postMcp({ path: `/c/${registered.secret}/mcp`, body: initializeBody('Client One') }),
      ),
      ...Array.from({ length: CONCURRENT_CALLS }, (_, index) =>
        getPage({ installCode: registered.installCode, address: `203.0.113.${100 + index}` }),
      ),
    ]);
    expect(results.every((response) => response.status === 200 || response.status === 410)).toBe(true);
    await vi.waitFor(async () =>
      expect((await readConnection({ secretDigest: registered.connection.secretDigest })).clientName).toBe('Client One'),
    );
  });

  it('IS-S2 stores neither the secret nor the install code in clear in the directory', async () => {
    const accountId = await seedAccount({});
    const registered = await registerWithInstallCode({ accountId, agent: 'claude', expiresAt: validExpiry() });
    const rows = await testEnv.CONNECTIONS.prepare('SELECT * FROM connections').all();
    const dump = JSON.stringify(rows.results);
    expect(dump).not.toContain(registered.secret);
    expect(dump).not.toContain(registered.installCode);
    expect(dump).not.toContain('zb_conn_');
    expect(dump).not.toContain(INSTALL_CODE_PREFIX);
    expect(registered.connection.installCodeDigest).toMatch(/^[0-9a-f]{64}$/);
  });

  it('IS-W8 answers an expired code in the account locale without the secret', async () => {
    const accountId = await seedAccount({ locale: OwnerLocale.PortugueseBrazil });
    const registered = await registerWithInstallCode({ accountId, agent: 'claude', expiresAt: Date.now() - 1 });
    const response = await getPage({ installCode: registered.installCode });
    const text = await response.text();
    expect(response.status).toBe(410);
    expect(text).toContain('renovar <nome>');
    expect(text).not.toContain(registered.secret);
  });
});
