import { env } from 'cloudflare:test';
import { MessageKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { DevAccountInbox } from '../../src/dev/dev-account-inbox';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import production, { AccountInbox } from '../../src/index';
import { ORIGIN, seedAccount } from './route-fixtures';

const STATUS_OK = 200;
const STATUS_NOT_FOUND = 404;
const DEV_METHODS = ['readScreen', 'advanceClock'];

async function request(input: { path: string; method: string; body?: Record<string, unknown> }): Promise<Response> {
  return production.fetch(
    new Request(`${ORIGIN}${input.path}`, {
      method: input.method,
      headers: { 'Content-Type': 'application/json' },
      body: input.body ? JSON.stringify(input.body) : undefined,
    }),
    { ...env, ENVIRONMENT: DeployEnvironment.Production },
  );
}

describe('production entry', () => {
  test('WI-117 /health answers 200 with ok true and the environment', async () => {
    const response = await request({ path: '/health', method: 'GET' });
    expect(response.status).toBe(STATUS_OK);
    expect(await response.json()).toEqual({ ok: true, environment: DeployEnvironment.Production });
  });

  test('WI-109 WI-110 WI-111 the simulator routes answer 404', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const responses = await Promise.all([
      request({ path: `/dev/owner/${account.phone}/messages`, method: 'POST', body: { kind: MessageKind.Text, text: 'oi' } }),
      request({ path: `/dev/owner/${account.phone}/screen`, method: 'GET' }),
      request({ path: `/dev/owner/${account.phone}/clock`, method: 'POST', body: { advance_ms: 1 } }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([STATUS_NOT_FOUND, STATUS_NOT_FOUND, STATUS_NOT_FOUND]);
  });

  test('WI-112 MCP answers on the production entry', async () => {
    const account = await seedAccount({ agent: 'alpha' });
    const response = await production.fetch(
      new Request(`${ORIGIN}/c/${account.secret}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
      env,
    );
    expect(response.status).toBe(STATUS_OK);
  });

  test('WI-122 the production class has no development methods and the development class has both', () => {
    expect(DEV_METHODS.filter((method) => method in AccountInbox.prototype)).toEqual([]);
    expect(DEV_METHODS.filter((method) => method in DevAccountInbox.prototype)).toEqual(DEV_METHODS);
  });
});
