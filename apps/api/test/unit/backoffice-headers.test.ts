import { HttpStatus } from '@zapbip/types';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BackofficeEnv } from '../../src/backoffice/backoffice-env';
import { handleBackofficeError, securityHeaders } from '../../src/backoffice/security-headers';
import { DeployEnvironment } from '../../src/contract/deploy-environment';
import { LogEvent } from '../../src/contract/log';

const SEE_OTHER = 303;
const CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";
const HTTP_STRICT_TRANSPORT_SECURITY = 'max-age=63072000; includeSubDomains';
const STYLESHEET_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const STYLESHEET_PATH = '/assets/backoffice.css';
const THROWING_PATH = '/boom';
const SECRET_MESSAGE = 'sensitive message that must not be logged';

const COMMON_HEADERS: Record<string, string> = {
  'content-security-policy': CONTENT_SECURITY_POLICY,
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'cache-control': 'no-store',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'x-robots-tag': 'noindex, nofollow',
};

const STATUSES = [HttpStatus.Ok, SEE_OTHER, HttpStatus.Unauthorized, HttpStatus.Forbidden, HttpStatus.NotFound, HttpStatus.TooManyRequests];

function createApp(): Hono<BackofficeEnv> {
  const app = new Hono<BackofficeEnv>();
  app.use('*', securityHeaders);
  app.onError(handleBackofficeError);
  app.get(THROWING_PATH, () => {
    throw new Error(SECRET_MESSAGE);
  });
  app.get(STYLESHEET_PATH, () => new Response('body{}', { headers: { 'Cache-Control': STYLESHEET_CACHE_CONTROL } }));
  STATUSES.forEach((status) => app.get(`/status/${status}`, () => new Response(null, { status })));
  return app;
}

function requestAs(input: { path: string; environment: DeployEnvironment }): Response | Promise<Response> {
  return createApp().request(input.path, {}, { ENVIRONMENT: input.environment });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('backoffice security headers', () => {
  it.each(STATUSES)('attaches the ten headers of the spec on a %s response', async (status) => {
    const response = await requestAs({ path: `/status/${status}`, environment: DeployEnvironment.Production });
    expect(response.status).toBe(status);
    expect(Object.fromEntries(Object.keys(COMMON_HEADERS).map((name) => [name, response.headers.get(name)]))).toEqual(COMMON_HEADERS);
    expect(response.headers.get('strict-transport-security')).toBe(HTTP_STRICT_TRANSPORT_SECURITY);
  });

  it('attaches the ten headers on a response forced to 500', async () => {
    const response = await requestAs({ path: THROWING_PATH, environment: DeployEnvironment.Staging });
    expect(response.status).toBe(HttpStatus.InternalServerError);
    expect(Object.fromEntries(Object.keys(COMMON_HEADERS).map((name) => [name, response.headers.get(name)]))).toEqual(COMMON_HEADERS);
    expect(response.headers.get('strict-transport-security')).toBe(HTTP_STRICT_TRANSPORT_SECURITY);
  });

  it('sends no strict transport security in development', async () => {
    const response = await requestAs({ path: '/status/200', environment: DeployEnvironment.Development });
    expect(response.headers.get('strict-transport-security')).toBeNull();
  });

  it('lets the stylesheet cache while keeping the other nine headers', async () => {
    const response = await requestAs({ path: STYLESHEET_PATH, environment: DeployEnvironment.Production });
    expect(response.headers.get('cache-control')).toBe(STYLESHEET_CACHE_CONTROL);
    expect(response.headers.get('content-security-policy')).toBe(CONTENT_SECURITY_POLICY);
  });

  it('logs only the class name of an unhandled error', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const response = await requestAs({ path: THROWING_PATH, environment: DeployEnvironment.Production });
    expect(logSpy.mock.calls.map(([line]) => String(line))).toEqual([
      JSON.stringify({ event: LogEvent.BackofficeError, errorCode: 'Error' }),
    ]);
    expect(await response.text()).not.toContain(SECRET_MESSAGE);
  });
});
