import { HttpStatus } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { DeployEnvironment } from '../../src/contract/deploy-environment';
import { httpsRedirectOf } from '../../src/https-redirect';

const PERMANENT_REDIRECT = 308;

function redirectOf(input: { url: string; method?: string; environment?: DeployEnvironment }): Response | null {
  const { url, method = 'GET', environment = DeployEnvironment.Production } = input;
  return httpsRedirectOf({ request: new Request(url, { method }), environment });
}

describe('httpsRedirectOf', () => {
  it.each(['GET', 'HEAD'])('answers a plain %s with a 301 to the same URL over https', (method) => {
    const response = redirectOf({ url: 'http://zapbip.com/pt-br?ref=abcdefgh2345&agent=codex', method })!;
    expect(response.status).toBe(HttpStatus.MovedPermanently);
    expect(response.headers.get('Location')).toBe('https://zapbip.com/pt-br?ref=abcdefgh2345&agent=codex');
  });

  it.each(['POST', 'PUT', 'DELETE', 'PATCH'])('answers a plain %s with a 308 so the method and body survive', (method) => {
    const response = redirectOf({ url: 'http://staging.zapbip.com/join', method })!;
    expect(response.status).toBe(PERMANENT_REDIRECT);
    expect(response.headers.get('Location')).toBe('https://staging.zapbip.com/join');
  });

  it.each(['http://zapbip.com/', 'http://backoffice.zapbip.com/sign-in', 'http://mcp.zapbip.com/health', 'http://www.zapbip.com/x'])(
    'redirects any host the Worker serves: %s',
    (url) => {
      expect(redirectOf({ url })!.headers.get('Location')).toBe(url.replace('http:', 'https:'));
    },
  );

  it('leaves an https request alone', () => {
    expect(redirectOf({ url: 'https://zapbip.com/' })).toBeNull();
  });

  it('leaves development alone, where the local host has no certificate', () => {
    expect(redirectOf({ url: 'http://site.localhost:8787/', environment: DeployEnvironment.Development })).toBeNull();
  });

  it('keeps the port of a plain request out of the https address only when it is the default one', () => {
    expect(redirectOf({ url: 'http://zapbip.com:80/x' })!.headers.get('Location')).toBe('https://zapbip.com/x');
  });
});
