import { META_APP_ID, META_LOGIN_CONFIGURATION_ID, WhatsAppNumberState } from '@zapbip/types';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { GRAPH_API_VERSION } from '../../src/adapters/whatsapp/whatsapp-constants';
import { STYLESHEET_CACHE_CONTROL } from '../../src/backoffice/backoffice-constants';
import { seedWhatsAppNumber } from '../support/whatsapp-numbers';
import { backofficeEnv, requestBackoffice, SESSION_COOKIE } from './backoffice-auth-fixtures';
import { endBackofficeSession, getPage, postAction, startBackofficeSession } from './backoffice-numbers-fixtures';

const META_PATH = '/numbers/connect/meta';
const SCRIPT_PATH = '/assets/embedded-signup.js';
const NUMBER_ID = 'num_headers';
const STATUS_OK = 200;
const STATUS_SEE_OTHER = 303;
const STATUS_NOT_FOUND = 404;
const STATUS_SERVER_ERROR = 500;
const STRICT_POLICY = "default-src 'none'; style-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";
const ONBOARDING_POLICY = [
  "default-src 'none'",
  "script-src 'self' https://connect.facebook.net",
  'frame-src https://www.facebook.com https://web.facebook.com https://staticxx.facebook.com',
  'connect-src https://www.facebook.com https://graph.facebook.com',
  "img-src 'self' https://www.facebook.com",
  "style-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join('; ');
const SHARED_HEADERS: [string, string][] = [
  ['x-frame-options', 'DENY'],
  ['x-content-type-options', 'nosniff'],
  ['referrer-policy', 'same-origin'],
  ['cross-origin-resource-policy', 'same-origin'],
  ['permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'],
  ['x-robots-tag', 'noindex, nofollow'],
  ['cache-control', 'no-store'],
];

let sessionToken: string;

beforeEach(async () => {
  sessionToken = await startBackofficeSession();
  await seedWhatsAppNumber({ numberId: NUMBER_ID, state: WhatsAppNumberState.Active });
});

afterEach(endBackofficeSession);

async function grantedMetaPage(): Promise<Response> {
  await postAction({ path: '/numbers/connect', sessionToken, fields: {} });
  return getPage({ path: META_PATH, sessionToken });
}

describe('the onboarding page', () => {
  test('answers the exact policy of ADR 0037 and the popup-friendly opener policy, and keeps every other header', async () => {
    const response = await grantedMetaPage();
    expect(response.status).toBe(STATUS_OK);
    expect(response.headers.get('content-security-policy')).toBe(ONBOARDING_POLICY);
    expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin-allow-popups');
    SHARED_HEADERS.forEach(([name, value]) => expect(response.headers.get(name)).toBe(value));
  });

  test('without a grant it redirects to the step-up and keeps the strict policy', async () => {
    const response = await getPage({ path: META_PATH, sessionToken });
    expect(response.status).toBe(STATUS_SEE_OTHER);
    expect(response.headers.get('Location')).toBe('/numbers/connect');
    expect(response.headers.get('content-security-policy')).toBe(STRICT_POLICY);
  });

  test('renders the fixed app, the configuration and the Graph version as data attributes, and no inline script', async () => {
    const body = await (await grantedMetaPage()).text();
    expect(body).toContain(`data-app-id="${META_APP_ID}"`);
    expect(body).toContain(`data-configuration-id="${META_LOGIN_CONFIGURATION_ID}"`);
    expect(body).toContain(`data-graph-version="${GRAPH_API_VERSION}"`);
    expect(body.match(/<script[^>]*>/g)).toEqual([
      expect.stringContaining('src="/assets/embedded-signup.js'),
      expect.stringContaining('src="https://connect.facebook.net/en_US/sdk.js"'),
    ]);
    expect(body).not.toMatch(/<script(?![^>]*\ssrc=)[^>]*>/);
    expect(body).not.toMatch(/\son[a-z]+=/);
  });

  test('renders the label, the six digit pin and the hidden signup fields', async () => {
    const body = await (await grantedMetaPage()).text();
    ['signupCode', 'phoneNumberId', 'wabaId', 'csrf'].forEach((name) =>
      expect(body).toMatch(new RegExp(`<input type="hidden" name="${name}"`)),
    );
    expect(body).toMatch(/name="label"[^>]*maxlength="60"/);
    expect(body).toMatch(/name="pin"[^>]*pattern="\[0-9\]\{6\}"/);
    expect(body).toContain('action="/numbers/connect/meta"');
  });
});

describe('every other page keeps the strict policy byte for byte', () => {
  test.each(['/numbers/connect', '/numbers', `/numbers/${NUMBER_ID}`, '/', '/nope'])('%s', async (path) => {
    const response = await getPage({ path, sessionToken });
    expect(response.headers.get('content-security-policy')).toBe(STRICT_POLICY);
    expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin');
  });

  test('the sign-in page', async () => {
    const response = await requestBackoffice({ path: '/sign-in' });
    expect(response.headers.get('content-security-policy')).toBe(STRICT_POLICY);
    expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin');
  });

  test('a 404 for an unknown number', async () => {
    const response = await getPage({ path: '/numbers/num_missing', sessionToken });
    expect(response.status).toBe(STATUS_NOT_FOUND);
    expect(response.headers.get('content-security-policy')).toBe(STRICT_POLICY);
  });

  test('a 500 after the onboarding page was served', async () => {
    await grantedMetaPage();
    const failing = new Proxy(backofficeEnv({}).CONNECTIONS, {
      get(target, property) {
        if (property === 'batch') return () => Promise.reject(new Error('batch refused'));
        const member = Reflect.get(target, property);
        return typeof member === 'function' ? member.bind(target) : member;
      },
    });
    const response = await requestBackoffice({
      path: '/',
      cookies: { [SESSION_COOKIE]: sessionToken },
      env: backofficeEnv({ overrides: { CONNECTIONS: failing } }),
    });
    expect(response.status).toBe(STATUS_SERVER_ERROR);
    expect(response.headers.get('content-security-policy')).toBe(STRICT_POLICY);
    expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin');
  });
});

describe('the onboarding script asset', () => {
  test('answers JavaScript with the stylesheet cache header and the strict policy', async () => {
    const response = await requestBackoffice({ path: SCRIPT_PATH });
    expect(response.status).toBe(STATUS_OK);
    expect(response.headers.get('content-type')).toBe('text/javascript; charset=utf-8');
    expect(response.headers.get('cache-control')).toBe(STYLESHEET_CACHE_CONTROL);
    expect(response.headers.get('content-security-policy')).toBe(STRICT_POLICY);
  });

  test('checks the message origin, gates the submit on a finished signup, and never evaluates strings', async () => {
    const script = await (await requestBackoffice({ path: SCRIPT_PATH })).text();
    ['WA_EMBEDDED_SIGNUP', 'FINISH', 'CANCEL', 'facebook.com', 'requestSubmit', 'reportValidity', 'config_id'].forEach((part) =>
      expect(script).toContain(part),
    );
    ['eval(', 'innerHTML', 'document.write'].forEach((part) => expect(script).not.toContain(part));
  });
});
