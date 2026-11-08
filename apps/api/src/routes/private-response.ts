import { HttpStatus } from './http-status';

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
