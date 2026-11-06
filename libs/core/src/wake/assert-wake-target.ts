import { WakeProvider } from '@zapbip/types';
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
import { PINNED_WAKE_PROVIDER_RULES, type PinnedWakeProvider, type PinnedWakeProviderRule } from './wake-provider';
import type { WakeTarget } from './wake-setting';

enum WakeTargetField {
  Url = 'url',
  Token = 'token',
}

type PinnedMatch = { provider: PinnedWakeProvider; rule: PinnedWakeProviderRule };

const HTTPS_PROTOCOL = 'https:';
const HOST_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const IPV4_PATTERN = /^\d+(\.\d+){3}$/;
const WHITESPACE_PATTERN = /\s/;
const FRAGMENT_MARK = '#';

export type AssertWakeTargetInput = { url: string; token: string; publicHost: string };

function invalidField(input: { field: WakeTargetField }) {
  return invalidInput({ message: `invalid ${input.field}` });
}

function parseWakeUrl(input: { url: string }): URL {
  const { url } = input;
  const hasValidShape = url.length > 0 && url.length <= WAKE_URL_MAX_CHARS && !WHITESPACE_PATTERN.test(url) && !url.includes(FRAGMENT_MARK);
  if (!hasValidShape || !URL.canParse(url)) throw invalidField({ field: WakeTargetField.Url });
  const parsed = new URL(url);
  const hasUserinfo = parsed.username !== '' || parsed.password !== '';
  const isPlainHttps = parsed.protocol === HTTPS_PROTOCOL && parsed.port === '' && !hasUserinfo;
  if (!isPlainHttps) throw invalidField({ field: WakeTargetField.Url });
  return parsed;
}

function findPinnedMatch(input: { hostname: string }): PinnedMatch | null {
  const providers = Object.keys(PINNED_WAKE_PROVIDER_RULES) as PinnedWakeProvider[];
  const provider = providers.find((candidate) => PINNED_WAKE_PROVIDER_RULES[candidate].host === input.hostname);
  if (provider === undefined) return null;
  return { provider, rule: PINNED_WAKE_PROVIDER_RULES[provider] };
}

function assertGenericHost(input: { hostname: string; publicHost: string }): void {
  const { hostname, publicHost } = input;
  const isBlockedName = WAKE_BLOCKED_HOSTS.includes(hostname) || WAKE_BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
  const isPublicName = HOST_PATTERN.test(hostname) && !IPV4_PATTERN.test(hostname);
  const isOwnHost = hostname === publicHost.toLowerCase();
  if (!isPublicName || isBlockedName || isOwnHost) throw invalidField({ field: WakeTargetField.Url });
}

function assertToken(input: { token: string; minChars: number }): void {
  const { token, minChars } = input;
  const hasValidLength = token.length >= minChars && token.length <= WAKE_TOKEN_MAX_CHARS;
  if (!hasValidLength || !WAKE_TOKEN_PATTERN.test(token)) throw invalidField({ field: WakeTargetField.Token });
}

export function assertWakeTarget(input: AssertWakeTargetInput): WakeTarget {
  const { url, token, publicHost } = input;
  const parsed = parseWakeUrl({ url });
  const pinned = findPinnedMatch({ hostname: parsed.hostname });
  if (pinned === null) {
    assertGenericHost({ hostname: parsed.hostname, publicHost });
    assertToken({ token, minChars: WAKE_GENERIC_TOKEN_MIN_CHARS });
    return { provider: WakeProvider.GenericWebhook, url, token };
  }
  if (!pinned.rule.pathPattern.test(parsed.pathname)) throw invalidField({ field: WakeTargetField.Url });
  assertToken({ token, minChars: WAKE_TOKEN_MIN_CHARS });
  return { provider: pinned.provider, url, token };
}
