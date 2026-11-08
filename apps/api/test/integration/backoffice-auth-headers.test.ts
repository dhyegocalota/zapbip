import { createExecutionContext, env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import production from '../../src/index';

const BACKOFFICE_ORIGIN = 'http://backoffice.localhost:8787';
const TRAILING_DOT_ORIGIN = 'http://backoffice.localhost.:8787';
const CONTENT_SECURITY_POLICY =
  "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

function fetchPath(input: { origin: string; path: string }): Promise<Response> {
  return Promise.resolve(production.fetch(new Request(`${input.origin}${input.path}`), env, createExecutionContext()));
}

describe('backoffice response headers on the real app', () => {
  test('an unknown path answers 404 with the policy', async () => {
    const response = await fetchPath({ origin: BACKOFFICE_ORIGIN, path: '/nope' });
    expect(response.status).toBe(404);
    expect(response.headers.get('content-security-policy')).toBe(CONTENT_SECURITY_POLICY);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  test.each(['/sign-in', '/health'])('a trailing-dot host answers 404 on %s with the policy', async (path) => {
    const response = await fetchPath({ origin: TRAILING_DOT_ORIGIN, path });
    expect(response.status).toBe(404);
    expect(response.headers.get('content-security-policy')).toBe(CONTENT_SECURITY_POLICY);
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
});
