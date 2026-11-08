import { RATE_LIMIT_PERIOD_MS } from '@zapbip/core';
import { SECOND_MS } from '@zapbip/types';
import { HttpStatus } from './http-status';

export const BAD_REQUEST_TEXT = 'bad request';
export const SERVER_ERROR_TEXT = 'server error';
export const RATE_LIMITED_TEXT = 'too many requests';
export const RETRY_AFTER_HEADER = 'Retry-After';
export const RATE_LIMIT_RETRY_AFTER_SECONDS = RATE_LIMIT_PERIOD_MS / SECOND_MS;
const PLAIN_CONTENT_TYPE = 'text/plain; charset=utf-8';
const HSTS_MAX_AGE_SECONDS = 63_072_000;
const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`,
};

export function privateResponse(input: { body: string | null; status: HttpStatus; headers: Record<string, string> }): Response {
  return new Response(input.body, { status: input.status, headers: { ...PRIVATE_HEADERS, ...input.headers } });
}

export function plainResponse(input: { body: string; status: HttpStatus; headers?: Record<string, string> }): Response {
  return privateResponse({ ...input, headers: { 'Content-Type': PLAIN_CONTENT_TYPE, ...input.headers } });
}
