import { createExecutionContext, reset } from 'cloudflare:test';
import { CLIENT_APP_TOKEN_LENGTH, HttpStatus, OwnerLocale, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import developmentEntry from '../../src/index.dev';
import productionEntry from '../../src/index';
import { HEALTH_PATH } from '../../src/contract/constants';
import { clientAppEnvironment, clientAppFetch, prepareClientAppDatabase } from '../support/client-app';
import { seedStartNumber } from '../support/start-link-numbers';
import { testEnv } from '../support/workers-env';

const APP_ORIGIN = 'https://app.zapbip.com';
const MCP_ORIGIN = 'https://mcp.zapbip.com';
const NUMBER_DIGITS = '5511977770001';
const NUMBER_CREATED_AT = 1_700_000_000_000;
const environment = { ...testEnv, APP_ORIGIN, PUBLIC_ORIGIN: MCP_ORIGIN };
const entries = [
  { name: 'production', entry: productionEntry },
  { name: 'development', entry: developmentEntry },
];

beforeEach(prepareClientAppDatabase);
afterEach(reset);

describe.each(entries)('$name entry app host dispatch', ({ entry }) => {
  it('the app host serves the app and not the MCP app', async () => {
    const response = await entry.fetch(new Request(`${APP_ORIGIN}/`), environment, createExecutionContext());
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect((await entry.fetch(new Request(`${APP_ORIGIN}${HEALTH_PATH}`), environment, createExecutionContext())).status).toBe(
      HttpStatus.NotFound,
    );
  });

  it('the MCP host does not serve the app routes', async () => {
    const response = await entry.fetch(
      new Request(`${MCP_ORIGIN}/sign-in/${'A'.repeat(CLIENT_APP_TOKEN_LENGTH)}`),
      environment,
      createExecutionContext(),
    );
    expect(response.status).toBe(HttpStatus.NotFound);
  });
});

describe.each(entries)('$name entry app host edge cases', ({ entry }) => {
  it('rejects the app host with a trailing dot instead of serving the MCP app', async () => {
    const response = await entry.fetch(new Request(`https://app.zapbip.com.${HEALTH_PATH}`), environment, createExecutionContext());
    expect(response.status).toBe(HttpStatus.NotFound);
  });
});

describe('the assets', () => {
  it.each(['/app.css', '/favicon.svg'])('%s is served without looking up the session', async (path) => {
    const broken = clientAppEnvironment({ overrides: { CONNECTIONS: undefined as never } });
    const response = await clientAppFetch({ path, cookie: 'any-session-cookie', env: broken });
    expect(response.status).toBe(HttpStatus.Ok);
  });
});

describe('the app headers', () => {
  it('carry a script-free policy, same-origin referrer and no store on every page', async () => {
    const { headers } = await clientAppFetch({ path: '/' });
    const policy = headers.get('content-security-policy')!;
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toContain('script-src');
    expect(headers.get('referrer-policy')).toBe('same-origin');
    expect(headers.get('cache-control')).toBe('no-store');
    expect(headers.get('x-frame-options')).toBe('DENY');
  });

  it('serves the stylesheet as cacheable CSS', async () => {
    const response = await clientAppFetch({ path: '/app.css' });
    expect(response.headers.get('content-type')).toContain('text/css');
    expect(response.headers.get('cache-control')).toContain('immutable');
  });

  it('answers an unknown path with a 404 page', async () => {
    expect((await clientAppFetch({ path: '/nothing-here' })).status).toBe(HttpStatus.NotFound);
  });
});

describe('the sign-in button', () => {
  it.each([
    ['/', OwnerLocale.EnglishUs, 'login'],
    ['/pt-br', OwnerLocale.PortugueseBrazil, 'entrar'],
  ])('%s opens WhatsApp with the %s login word', async (path, _locale, word) => {
    await seedStartNumber({
      numberId: 'num_app_start',
      displayNumber: `+${NUMBER_DIGITS}`,
      state: WhatsAppNumberState.Active,
      createdAt: NUMBER_CREATED_AT,
    });
    const html = await (await clientAppFetch({ path })).text();
    expect(html).toContain(`https://wa.me/${NUMBER_DIGITS}?text=${word}`);
  });

  it('answers 503 when no start number is active', async () => {
    const response = await clientAppFetch({ path: '/' });
    expect(response.status).toBe(HttpStatus.ServiceUnavailable);
  });
});
