import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const PORT_VARIABLE = 'DOCS_PORT';
const LEGACY_FIXED_PORT = 3310;
const OVERRIDE_PORT = 4555;

async function loadConfig() {
  vi.resetModules();
  const module = await import('../../../apps/docs/playwright.config');
  return module.default;
}

function portOf(address: string | undefined): number {
  if (!address) throw new Error('address missing');
  return Number(new URL(address).port);
}

describe('docs walk server', () => {
  const originalPort = process.env[PORT_VARIABLE];

  beforeEach(() => {
    delete process.env[PORT_VARIABLE];
  });

  afterEach(() => {
    if (originalPort === undefined) delete process.env[PORT_VARIABLE];
    if (originalPort !== undefined) process.env[PORT_VARIABLE] = originalPort;
  });

  test('never reuses an existing server', async () => {
    const config = await loadConfig();
    expect(config.webServer).toMatchObject({ reuseExistingServer: false });
  });

  test('picks a free port instead of a fixed one when there is no override', async () => {
    const config = await loadConfig();
    const port = portOf(config.use?.baseURL);
    expect(port).not.toBe(LEGACY_FIXED_PORT);
    expect(port).toBeGreaterThan(0);
  });

  test('serves and browses the same port', async () => {
    const config = await loadConfig();
    const server = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;
    expect(portOf(server?.url)).toBe(portOf(config.use?.baseURL));
    expect(server?.command).toContain(`--port ${portOf(config.use?.baseURL)} `);
  });

  test('follows the explicit port override', async () => {
    process.env[PORT_VARIABLE] = String(OVERRIDE_PORT);
    const config = await loadConfig();
    expect(portOf(config.use?.baseURL)).toBe(OVERRIDE_PORT);
  });
});
