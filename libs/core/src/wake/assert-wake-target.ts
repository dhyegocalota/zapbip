import { GENERIC_WAKE_PROVIDER } from '@zapbip/types';
import type { InboxError } from '../inbox/errors';
import { invalidInput } from '../inbox/inbox-error-factories';
import {
  WAKE_BLOCKED_HOST_SUFFIXES,
  WAKE_BLOCKED_HOSTS,
  WAKE_GENERIC_TOKEN_MIN_CHARS,
  WAKE_TOKEN_MAX_CHARS,
  WAKE_TOKEN_MIN_CHARS,
  WAKE_TOKEN_PATTERN,
  WAKE_URL_MAX_CHARS,
} from './constants';
import type { PinnedWakeProviderRule } from './wake-provider';
import type { WakeTarget } from './wake-setting';

export enum WakeTargetField {
  Url = 'url',
  Token = 'token',
}

const HTTPS_PROTOCOL = 'https:';
const HOST_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const IPV4_PATTERN = /^\d+(\.\d+){3}$/;
const WHITESPACE_PATTERN = /\s/;
const FRAGMENT_MARK = '#';
const SCHEME_SEPARATOR = '://';

export type AssertWakeTargetInput = { url: string; token: string; publicHost: string; pinnedProviders: PinnedWakeProviderRule[] };

export function invalidWakeField(input: { field: WakeTargetField }): InboxError {
  return invalidInput({ message: `invalid ${input.field}` });
}

function parseWakeUrl(input: { url: string }): URL {
  const { url } = input;
  const hasValidShape = url.length > 0 && url.length <= WAKE_URL_MAX_CHARS && !WHITESPACE_PATTERN.test(url) && !url.includes(FRAGMENT_MARK);
  if (!hasValidShape || !URL.canParse(url)) throw invalidWakeField({ field: WakeTargetField.Url });
  const parsed = new URL(url);
  const hasUserinfo = parsed.username !== '' || parsed.password !== '';
  const isPlainHttps = parsed.protocol === HTTPS_PROTOCOL && parsed.port === '' && !hasUserinfo;
  if (!isPlainHttps) throw invalidWakeField({ field: WakeTargetField.Url });
  return parsed;
}

function findPinnedRule(input: { hostname: string; pinnedProviders: PinnedWakeProviderRule[] }): PinnedWakeProviderRule | null {
  const rule = input.pinnedProviders.find((candidate) => candidate.host === input.hostname);
  return rule === undefined ? null : rule;
}

function hostnameOf(input: { publicHost: string }): string {
  const origin = input.publicHost.includes(SCHEME_SEPARATOR) ? input.publicHost : `${HTTPS_PROTOCOL}//${input.publicHost}`;
  return new URL(origin).hostname;
}

function assertGenericHost(input: { hostname: string; publicHost: string }): void {
  const { hostname, publicHost } = input;
  const isBlockedName = WAKE_BLOCKED_HOSTS.includes(hostname) || WAKE_BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  const isPublicName = HOST_PATTERN.test(hostname) && !IPV4_PATTERN.test(hostname);
  const ownHost = hostnameOf({ publicHost });
  const isOwnHost = hostname === ownHost || hostname.endsWith(`.${ownHost}`);
  if (!isPublicName || isBlockedName || isOwnHost) throw invalidWakeField({ field: WakeTargetField.Url });
}

function assertToken(input: { token: string; minChars: number }): void {
  const { token, minChars } = input;
  const hasValidLength = token.length >= minChars && token.length <= WAKE_TOKEN_MAX_CHARS;
  if (!hasValidLength || !WAKE_TOKEN_PATTERN.test(token)) throw invalidWakeField({ field: WakeTargetField.Token });
}

export function assertWakeTarget(input: AssertWakeTargetInput): WakeTarget {
  const { url, token, publicHost, pinnedProviders } = input;
  const parsed = parseWakeUrl({ url });
  const pinned = findPinnedRule({ hostname: parsed.hostname, pinnedProviders });
  if (pinned === null) {
    assertGenericHost({ hostname: parsed.hostname, publicHost });
    assertToken({ token, minChars: WAKE_GENERIC_TOKEN_MIN_CHARS });
    return { provider: GENERIC_WAKE_PROVIDER, url, token };
  }
  if (!pinned.pathPattern.test(parsed.pathname)) throw invalidWakeField({ field: WakeTargetField.Url });
  assertToken({ token, minChars: WAKE_TOKEN_MIN_CHARS });
  return { provider: pinned.providerId, url, token };
}
