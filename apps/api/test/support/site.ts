import { createExecutionContext } from 'cloudflare:test';
import { OwnerLocale, TURNSTILE_ACTION_WAITLIST_JOIN } from '@zapbip/types';
import { CLIENT_ADDRESS_HEADER } from '../../src/contract/constants';
import { createFakeEmailSender } from '../../src/adapters/fake/fake-email-sender';
import type { Bindings } from '../../src/contract/env';
import type { EmailSender } from '../../src/emails/email-sender';
import { renderShellCopy, type ShellCopyKey } from '../../src/web-shell/shell-copy';
import { createSiteApp } from '../../src/site/site-app';
import { renderSiteCopy, type SiteCopyKey } from '../../src/site/site-copy';
import { createFakeRateLimiter } from './fake-rate-limiter';
import { testEnv } from './workers-env';

export const SITE_ORIGIN = 'https://zapbip.com';
export const SITE_HOSTNAME = 'zapbip.com';
export const SITE_TURNSTILE_SECRET = 'site-test-turnstile-secret';
export const SITE_TURNSTILE_SITE_KEY = 'site-test-site-key';
export const WIDGET_TOKEN = 'widget-token';
export const CLIENT_ADDRESS = '203.0.113.9';
export const REFERRAL_CODE = 'abcdefgh2345';
const UNLIMITED = Number.MAX_SAFE_INTEGER;

export type SiteFetchRecording = { fetchImplementation: typeof fetch; calls: string[] };

export function acceptingTurnstile(): SiteFetchRecording {
  const calls: string[] = [];
  const fetchImplementation = (async (_url: string, init: RequestInit) => {
    calls.push(String(init.body));
    return Response.json({ success: true, hostname: SITE_HOSTNAME, action: TURNSTILE_ACTION_WAITLIST_JOIN });
  }) as unknown as typeof fetch;
  return { fetchImplementation, calls };
}

export function refusingTurnstile(): SiteFetchRecording {
  const calls: string[] = [];
  const fetchImplementation = (async (_url: string, init: RequestInit) => {
    calls.push(String(init.body));
    return Response.json({ success: false, 'error-codes': ['invalid-input-response'] });
  }) as unknown as typeof fetch;
  return { fetchImplementation, calls };
}

export function unreachableTurnstile(): SiteFetchRecording {
  const calls: string[] = [];
  const fetchImplementation = (async (_url: string, init: RequestInit) => {
    calls.push(String(init.body));
    throw new TypeError('network down');
  }) as unknown as typeof fetch;
  return { fetchImplementation, calls };
}

export function siteEnvironment(input: { overrides?: Partial<Bindings> }): Bindings {
  return {
    ...testEnv,
    SITE_ORIGIN,
    TURNSTILE_SECRET_KEY: SITE_TURNSTILE_SECRET,
    TURNSTILE_SITE_KEY: SITE_TURNSTILE_SITE_KEY,
    INSTALL_PAGE_LIMITER: createFakeRateLimiter({ limit: UNLIMITED }),
    ...input.overrides,
  };
}

export type SiteRequest = {
  path: string;
  method?: string;
  form?: Record<string, string>;
  body?: string;
  headers?: Record<string, string>;
  env?: Bindings;
  recording?: SiteFetchRecording;
  withClientAddress?: boolean;
  emailSender?: EmailSender;
  executionContext?: ExecutionContext;
};

export function joinForm(input: { email: string; referralCode?: string; locale?: OwnerLocale; token?: string }): Record<string, string> {
  const { email, referralCode, locale = OwnerLocale.EnglishUs, token = WIDGET_TOKEN } = input;
  return {
    email,
    locale,
    'cf-turnstile-response': token,
    ...(referralCode === undefined ? {} : { referralCode }),
  };
}

export async function siteFetch(input: SiteRequest): Promise<Response> {
  const {
    path,
    method = 'GET',
    form,
    body,
    headers = {},
    env = siteEnvironment({}),
    recording = acceptingTurnstile(),
    withClientAddress = true,
    emailSender = createFakeEmailSender(),
    executionContext = createExecutionContext(),
  } = input;
  const addressHeaders: Record<string, string> = withClientAddress ? { [CLIENT_ADDRESS_HEADER]: CLIENT_ADDRESS } : {};
  const request = new Request(`${SITE_ORIGIN}${path}`, {
    method,
    headers: { ...addressHeaders, ...headers },
    body: form === undefined ? body : new URLSearchParams(form),
  });
  return createSiteApp({ fetchImplementation: recording.fetchImplementation, emailSenderOf: () => emailSender }).fetch(
    request,
    env,
    executionContext,
  );
}

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapedHtml(input: { text: string }): string {
  return input.text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]!);
}

export function shellCopyHtml(input: { key: ShellCopyKey; locale: OwnerLocale }): string {
  return escapedHtml({ text: renderShellCopy(input) });
}

export function copyHtml(input: { key: SiteCopyKey; locale: OwnerLocale; values?: Record<string, string> }): string {
  return escapedHtml({ text: renderSiteCopy(input) });
}
