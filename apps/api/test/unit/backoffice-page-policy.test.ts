import { describe, expect, it } from 'vitest';
import { PAGE_POLICY_HEADERS, PagePolicy, STATIC_SECURITY_HEADERS } from '../../src/backoffice/backoffice-constants';

const POLICY_HEADERS = ['Content-Security-Policy', 'Cross-Origin-Opener-Policy'];

function withoutPolicyHeaders(input: { headers: Record<string, string> }): Record<string, string> {
  return Object.fromEntries(Object.entries(input.headers).filter(([name]) => !POLICY_HEADERS.includes(name)));
}

describe('the page policy record', () => {
  it('keeps the strict set exactly as the static security headers', () => {
    expect(PAGE_POLICY_HEADERS[PagePolicy.Strict]).toEqual(STATIC_SECURITY_HEADERS);
  });

  it('differs for the embedded signup page only in the content security policy and the opener policy', () => {
    const strict = PAGE_POLICY_HEADERS[PagePolicy.Strict];
    const signup = PAGE_POLICY_HEADERS[PagePolicy.EmbeddedSignup];
    expect(withoutPolicyHeaders({ headers: signup })).toEqual(withoutPolicyHeaders({ headers: strict }));
    expect(signup['Content-Security-Policy']).not.toBe(strict['Content-Security-Policy']);
    expect(signup['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups');
  });

  it('names no wildcard host', () => {
    expect(PAGE_POLICY_HEADERS[PagePolicy.EmbeddedSignup]['Content-Security-Policy']).not.toContain('*');
  });
});
