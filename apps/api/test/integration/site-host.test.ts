import { createExecutionContext } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { HEALTH_PATH, WHATSAPP_WEBHOOK_PATH } from '../../src/contract/constants';
import developmentEntry from '../../src/index.dev';
import productionEntry from '../../src/index';
import { testEnv } from '../support/workers-env';

const SITE_ORIGIN = 'https://zapbip.com';
const WWW_ORIGIN = 'https://www.zapbip.com';
const MCP_ORIGIN = 'https://mcp.zapbip.com';
const BACKOFFICE_ORIGIN = 'https://backoffice.zapbip.com';
const MOVED_PERMANENTLY = 301;
const NOT_FOUND = 404;
const OK = 200;
const SITE_ONLY_PATHS = ['/join', '/robots.txt', '/sitemap.xml'];
const MCP_PATHS = [HEALTH_PATH, WHATSAPP_WEBHOOK_PATH];

const environment = { ...testEnv, SITE_ORIGIN, PUBLIC_ORIGIN: MCP_ORIGIN, BACKOFFICE_ORIGIN };
const entries = [
  { name: 'production', entry: productionEntry },
  { name: 'development', entry: developmentEntry },
];

describe.each(entries)('$name entry site host dispatch', ({ entry }) => {
  function fetchFrom(input: { url: string; method?: string }): Promise<Response> | Response {
    return entry.fetch(new Request(input.url, { method: input.method }), environment, createExecutionContext());
  }

  test('sends www to the apex with a 301, keeping path and query', async () => {
    const response = await fetchFrom({ url: `${WWW_ORIGIN}/pricing?x=1` });
    expect(response.status).toBe(MOVED_PERMANENTLY);
    expect(response.headers.get('Location')).toBe(`${SITE_ORIGIN}/pricing?x=1`);
  });

  test('sends the www root to the apex root', async () => {
    const response = await fetchFrom({ url: `${WWW_ORIGIN}/?ref=abcdefgh2345` });
    expect(response.headers.get('Location')).toBe(`${SITE_ORIGIN}/?ref=abcdefgh2345`);
  });

  test('the apex host serves the site page and not the MCP app', async () => {
    const response = await fetchFrom({ url: `${SITE_ORIGIN}/` });
    expect(response.status).toBe(OK);
    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  test.each(MCP_PATHS)('the site host does not serve the MCP route %s', async (path) => {
    expect((await fetchFrom({ url: `${SITE_ORIGIN}${path}` })).status).toBe(NOT_FOUND);
  });

  test.each(SITE_ONLY_PATHS)('pin: the MCP host does not serve the site route %s', async (path) => {
    expect((await fetchFrom({ url: `${MCP_ORIGIN}${path}` })).status).toBe(NOT_FOUND);
  });

  test('pin: the backoffice host still serves the backoffice', async () => {
    expect((await fetchFrom({ url: `${BACKOFFICE_ORIGIN}/sign-in` })).status).toBe(OK);
  });

  test('pin: an unknown host is still the MCP app', async () => {
    expect((await fetchFrom({ url: `${MCP_ORIGIN}${HEALTH_PATH}` })).status).toBe(OK);
  });
});
