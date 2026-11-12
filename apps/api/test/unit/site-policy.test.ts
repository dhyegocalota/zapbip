import { describe, expect, it } from 'vitest';
import { SITE_CONTENT_SECURITY_POLICY } from '../../src/site/site-policy';

const EXPECTED_POLICY = [
  "default-src 'none'",
  "script-src 'self' https://challenges.cloudflare.com",
  'frame-src https://challenges.cloudflare.com',
  "img-src 'self'",
  "style-src 'self'",
  "media-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');

describe('the site content security policy', () => {
  it('pins the exact policy of ADR 0041', () => {
    expect(SITE_CONTENT_SECURITY_POLICY).toBe(EXPECTED_POLICY);
  });

  it('allows no inline script, no inline style and no wildcard', () => {
    expect(SITE_CONTENT_SECURITY_POLICY).not.toContain('unsafe-inline');
    expect(SITE_CONTENT_SECURITY_POLICY).not.toContain('*');
  });
});
