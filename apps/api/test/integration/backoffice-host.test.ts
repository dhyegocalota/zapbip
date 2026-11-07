import { createExecutionContext, env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { HEALTH_PATH, WHATSAPP_WEBHOOK_PATH } from '../../src/contract/constants';
import developmentEntry from '../../src/index.dev';
import productionEntry from '../../src/index';
import { ORIGIN, seedAccount } from './route-fixtures';

const STATUS_OK = 200;
const STATUS_NOT_FOUND = 404;
const BACKOFFICE_HOST = 'backoffice.localhost:8787';
const UPPERCASE_BACKOFFICE_HOST = 'BACKOFFICE.LOCALHOST:8787';
const OTHER_PORT_HOST = 'backoffice.localhost:8788';
const TRAILING_DOT_HOST = 'backoffice.localhost.:8787';
const INSTALL_CODE_PATH = '/i/zb_inst_AAAAAAAAAAAAAAAAAAAAAA';
const MCP_HOST_BACKOFFICE_PATHS = ['/sign-in', '/numbers', '/metrics', '/assets/backoffice.css'];

const FORWARDED_HEADERS = { 'X-Forwarded-Host': BACKOFFICE_HOST, 'X-Forwarded-Proto': 'https' };
const MCP_FORWARDED_HEADERS = { 'X-Forwarded-Host': new URL(ORIGIN).host, 'X-Forwarded-Proto': 'http' };

const entries = [
  { name: 'production', entry: productionEntry },
  { name: 'development', entry: developmentEntry },
];

async function fetchFrom(input: {
  entry: typeof productionEntry;
  host: string;
  path: string;
  method?: string;
  headers?: Record<string, string>;
}): Promise<Response> {
  const { entry, host, path, method = 'GET', headers } = input;
  return entry.fetch(new Request(`http://${host}${path}`, { method, headers }), env, createExecutionContext());
}

describe.each(entries)('$name entry host dispatch', ({ entry }) => {
  test('the backoffice host does not serve the MCP route', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const response = await fetchFrom({ entry, host: BACKOFFICE_HOST, path: `/c/${account.secret}/mcp` });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test('the backoffice host does not serve the WhatsApp webhook', async () => {
    const response = await fetchFrom({ entry, host: BACKOFFICE_HOST, path: WHATSAPP_WEBHOOK_PATH, method: 'POST' });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test('the backoffice host does not serve the health route', async () => {
    const response = await fetchFrom({ entry, host: BACKOFFICE_HOST, path: HEALTH_PATH });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test('the backoffice host does not serve an install page', async () => {
    const response = await fetchFrom({ entry, host: BACKOFFICE_HOST, path: INSTALL_CODE_PATH });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test.each(MCP_HOST_BACKOFFICE_PATHS)('the MCP host does not serve %s', async (path) => {
    const response = await entry.fetch(new Request(`${ORIGIN}${path}`), env, createExecutionContext());
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test('the host is compared case-insensitively', async () => {
    const response = await fetchFrom({ entry, host: UPPERCASE_BACKOFFICE_HOST, path: HEALTH_PATH });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test('another port is the MCP app', async () => {
    const response = await fetchFrom({ entry, host: OTHER_PORT_HOST, path: HEALTH_PATH });
    expect(response.status).toBe(STATUS_OK);
  });

  test.each([HEALTH_PATH, '/sign-in'])('a trailing dot on the backoffice host answers 404 on %s', async (path) => {
    const response = await fetchFrom({ entry, host: TRAILING_DOT_HOST, path });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test('a forwarded host naming the backoffice does not make the MCP host serve it', async () => {
    const response = await fetchFrom({ entry, host: new URL(ORIGIN).host, path: '/sign-in', headers: FORWARDED_HEADERS });
    expect(response.status).toBe(STATUS_NOT_FOUND);
  });

  test('a forwarded host naming the MCP app does not take the backoffice host away', async () => {
    const response = await fetchFrom({ entry, host: BACKOFFICE_HOST, path: HEALTH_PATH, headers: MCP_FORWARDED_HEADERS });
    expect(response.status).toBe(STATUS_NOT_FOUND);
    const signIn = await fetchFrom({ entry, host: BACKOFFICE_HOST, path: '/sign-in', headers: MCP_FORWARDED_HEADERS });
    expect(signIn.status).toBe(STATUS_OK);
  });
});
