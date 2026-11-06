import { SECOND_MS } from '@zapbip/types';

export const WAKE_DEBOUNCE_MS = 3 * SECOND_MS;
export const WAKE_MIN_INTERVAL_MS = 60 * SECOND_MS;
export const WAKE_REQUEST_TIMEOUT_MS = 10 * SECOND_MS;
export const WAKE_LEASE_MS = 15 * SECOND_MS;
export const WAKE_BACKOFF_BASE_MS = 5 * SECOND_MS;
export const WAKE_BACKOFF_CAP_MS = 60 * SECOND_MS;
export const WAKE_MAX_ATTEMPTS = 5;
export const WAKE_SIGNAL_BODY = '{"event":"inbox_has_messages"}';
export const WAKE_URL_MAX_CHARS = 512;
export const WAKE_TOKEN_MIN_CHARS = 16;
export const WAKE_TOKEN_MAX_CHARS = 512;
export const WAKE_GENERIC_TOKEN_MIN_CHARS = 32;
export const WAKE_TOKEN_PATTERN = /^[\x21-\x7E]+$/;
export const WAKE_SIGNATURE_TOLERANCE_S = 300;
export const WAKE_SEALED_KEY_VERSION = 1;
export const WAKE_SECRET_KEY_BYTES = 32;
export const WAKE_IV_BYTES = 12;
export const WAKE_BLOCKED_HOSTS: readonly string[] = ['localhost', 'zapbip.com'];
export const WAKE_BLOCKED_HOST_SUFFIXES: readonly string[] = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.arpa',
  '.zapbip.com',
  '.workers.dev',
];
export const WAKE_RETRY_AFTER_STATUSES: readonly number[] = [429, 503];
export const WAKE_CONTENT_TYPE = 'application/json';
export const WAKE_AUTHORIZATION_PREFIX = 'Bearer ';
export const WAKE_TIMESTAMP_HEADER = 'X-Zapbip-Timestamp';
export const WAKE_SIGNATURE_HEADER = 'X-Zapbip-Signature';
export const WAKE_SIGNATURE_PREFIX = 'sha256=';
export const CLAUDE_ROUTINE_BETA_HEADER = 'anthropic-beta';
export const CLAUDE_ROUTINE_BETA_VALUE = 'experimental-cc-routine-2026-04-01';
export const CLAUDE_ROUTINE_VERSION_HEADER = 'anthropic-version';
export const CLAUDE_ROUTINE_VERSION_VALUE = '2023-06-01';
