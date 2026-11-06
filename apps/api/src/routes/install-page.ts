import {
  INSTALL_PAGE_COPY,
  pickStandbyAgent,
  RATE_LIMIT_PERIOD_MS,
  renderInstallPage,
  type ConnectionRegistry,
  type InstallCodeDirectory,
  type InstallCodeResolution,
} from '@zapbip/core';
import { INSTALL_PAGE_PATH_PREFIX, InstallCodeStatus, SECOND_MS } from '@zapbip/types';
import { INSTALL_CODE_PREFIX, INSTALL_CODE_RANDOM_BYTES } from '@zapbip/types';
import { Hono, type Context } from 'hono';
import { createPlatformClock } from '../adapters/platform/clock';
import { joinStandbyCandidates } from '../install/install-page-adapter';
import type { WakeModeEntry } from '../contract/account-inbox-rpc';
import { HttpStatus } from './http-status';

export type RateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export type InstallPageRouteDependencies = {
  installCodeDirectory: InstallCodeDirectory;
  connectionRegistry: ConnectionRegistry;
  readWakeModes: (input: { accountId: string }) => Promise<WakeModeEntry[]>;
  limiter: RateLimiter;
};

const BASE64_BITS_PER_CHARACTER = 6;
const BITS_PER_BYTE = 8;
const INSTALL_CODE_BODY_LENGTH = Math.ceil((INSTALL_CODE_RANDOM_BYTES * BITS_PER_BYTE) / BASE64_BITS_PER_CHARACTER);
const INSTALL_CODE_PATTERN = new RegExp(`^${INSTALL_CODE_PREFIX}[A-Za-z0-9_-]{${INSTALL_CODE_BODY_LENGTH}}$`);
const CLIENT_ADDRESS_HEADER = 'cf-connecting-ip';
const INSTALL_CODE_PARAMETER = 'installCode';
const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8';
const PLAIN_CONTENT_TYPE = 'text/plain; charset=utf-8';
const NOT_FOUND_TEXT = 'not found';
const BAD_REQUEST_TEXT = 'bad request';
const RATE_LIMITED_TEXT = 'too many requests';
const RETRY_AFTER_SECONDS = RATE_LIMIT_PERIOD_MS / SECOND_MS;
const PRIVATE_HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };

function privateResponse(input: { body: string; status: HttpStatus; contentType: string; headers?: Record<string, string> }): Response {
  return new Response(input.body, {
    status: input.status,
    headers: { ...PRIVATE_HEADERS, 'Content-Type': input.contentType, ...input.headers },
  });
}

function plainResponse(input: { body: string; status: HttpStatus; headers?: Record<string, string> }): Response {
  return privateResponse({ ...input, contentType: PLAIN_CONTENT_TYPE });
}

type ReadyResolution = Extract<InstallCodeResolution, { status: InstallCodeStatus.Ready }>;

export function createInstallPageRoute(input: InstallPageRouteDependencies): Hono {
  const route = new Hono();

  async function renderReady(resolution: ReadyResolution): Promise<Response> {
    const { accountId, agent, connectionLink, locale } = resolution;
    const [connections, wakeModes] = await Promise.all([
      input.connectionRegistry.listActive({ accountId }),
      input.readWakeModes({ accountId }),
    ]);
    const standbyAgent = pickStandbyAgent({ agent, candidates: joinStandbyCandidates({ connections, wakeModes }) });
    const body = renderInstallPage({ agent, connectionLink, locale, standbyAgent });
    return privateResponse({ body, status: HttpStatus.Ok, contentType: MARKDOWN_CONTENT_TYPE });
  }

  async function serve(context: Context): Promise<Response> {
    const clientAddress = context.req.header(CLIENT_ADDRESS_HEADER);
    if (clientAddress === undefined) return plainResponse({ body: BAD_REQUEST_TEXT, status: HttpStatus.BadRequest });
    const { success } = await input.limiter.limit({ key: clientAddress });
    if (!success) {
      return plainResponse({
        body: RATE_LIMITED_TEXT,
        status: HttpStatus.TooManyRequests,
        headers: { 'Retry-After': String(RETRY_AFTER_SECONDS) },
      });
    }
    const installCode = context.req.param(INSTALL_CODE_PARAMETER);
    if (installCode === undefined) return plainResponse({ body: NOT_FOUND_TEXT, status: HttpStatus.NotFound });
    if (!INSTALL_CODE_PATTERN.test(installCode)) return plainResponse({ body: NOT_FOUND_TEXT, status: HttpStatus.NotFound });
    const resolution = await input.installCodeDirectory.resolve({ installCode, now: createPlatformClock().now() });
    if (resolution.status === InstallCodeStatus.Unknown) return plainResponse({ body: NOT_FOUND_TEXT, status: HttpStatus.NotFound });
    if (resolution.status !== InstallCodeStatus.Ready) {
      return plainResponse({ body: INSTALL_PAGE_COPY[resolution.locale].expired, status: HttpStatus.Gone });
    }
    return renderReady(resolution);
  }

  route.get(`${INSTALL_PAGE_PATH_PREFIX}:${INSTALL_CODE_PARAMETER}`, serve);
  return route;
}
