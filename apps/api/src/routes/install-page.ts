import { INSTALL_PAGE_SECTIONS } from '@zapbip/agents/install';
import {
  INSTALL_PAGE_COPY,
  pickStandbyAgent,
  renderInstallPage,
  type ConnectionRegistry,
  type InstallCodeDirectory,
  type InstallCodeResolution,
} from '@zapbip/core';
import { INSTALL_CODE_PREFIX, INSTALL_CODE_RANDOM_BYTES, INSTALL_PAGE_PATH_PREFIX, InstallCodeStatus, OwnerLocale } from '@zapbip/types';
import { Hono, type Context } from 'hono';
import { createPlatformClock } from '../adapters/platform/clock';
import { joinStandbyCandidates } from '../install/install-page-adapter';
import type { WakeModeEntry } from '../contract/account-inbox-rpc';
import { CLIENT_ADDRESS_HEADER } from '../contract/constants';
import { LogEvent } from '../contract/log';
import { logEvent } from '../log';
import { clientRateKey } from './client-rate-key';
import { HttpStatus } from './http-status';
import {
  BAD_REQUEST_TEXT,
  plainResponse,
  privateResponse,
  RATE_LIMIT_RETRY_AFTER_SECONDS,
  RATE_LIMITED_TEXT,
  RETRY_AFTER_HEADER,
  SERVER_ERROR_TEXT,
} from './private-response';

export type RateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export type InstallPageRouteDependencies = {
  installCodeDirectory: InstallCodeDirectory;
  connectionRegistry: ConnectionRegistry;
  readWakeModes: (input: { accountId: string }) => Promise<WakeModeEntry[]>;
  limiter: RateLimiter;
  requireSecureTransport: boolean;
};

const BASE64_BITS_PER_CHARACTER = 6;
const BITS_PER_BYTE = 8;
const INSTALL_CODE_BODY_LENGTH = Math.ceil((INSTALL_CODE_RANDOM_BYTES * BITS_PER_BYTE) / BASE64_BITS_PER_CHARACTER);
const INSTALL_CODE_PATTERN = new RegExp(`^${INSTALL_CODE_PREFIX}[A-Za-z0-9_-]{${INSTALL_CODE_BODY_LENGTH}}$`);
const INSTALL_CODE_PARAMETER = 'installCode';
const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8';
const NOT_FOUND_TEXT = INSTALL_PAGE_COPY[OwnerLocale.EnglishUs].notFound;
const SECURE_PROTOCOL = 'https:';
const USER_AGENT_HEADER = 'user-agent';
const LINK_PREVIEW_USER_AGENTS = [
  'whatsapp',
  'facebookexternalhit',
  'slackbot',
  'twitterbot',
  'discordbot',
  'telegrambot',
  'linkedinbot',
  'skypeuripreview',
  'applebot',
  'google-pagerenderer',
  'iframely',
  'embedly',
  'redditbot',
  'pinterestbot',
  'vkshare',
  'mastodon',
  'cardyb',
];
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
    const body = renderInstallPage({ agent, connectionLink, locale, standbyAgent, sections: INSTALL_PAGE_SECTIONS });
    return privateResponse({ body, status: HttpStatus.Ok, headers: { 'Content-Type': MARKDOWN_CONTENT_TYPE } });
  }

  async function serve(context: Context): Promise<Response> {
    const userAgent = context.req.header(USER_AGENT_HEADER);
    const isLinkPreviewCrawler =
      userAgent !== undefined && LINK_PREVIEW_USER_AGENTS.some((crawler) => userAgent.toLowerCase().includes(crawler));
    const isInsecure = input.requireSecureTransport && new URL(context.req.url).protocol !== SECURE_PROTOCOL;
    if (isLinkPreviewCrawler || isInsecure) return plainResponse({ body: NOT_FOUND_TEXT, status: HttpStatus.NotFound });
    const clientAddress = context.req.header(CLIENT_ADDRESS_HEADER);
    if (clientAddress === undefined) return plainResponse({ body: BAD_REQUEST_TEXT, status: HttpStatus.BadRequest });
    const { success } = await input.limiter.limit({ key: clientRateKey({ address: clientAddress }) });
    if (!success) {
      return plainResponse({
        body: RATE_LIMITED_TEXT,
        status: HttpStatus.TooManyRequests,
        headers: { [RETRY_AFTER_HEADER]: String(RATE_LIMIT_RETRY_AFTER_SECONDS) },
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
  route.notFound(() => plainResponse({ body: NOT_FOUND_TEXT, status: HttpStatus.NotFound }));
  route.onError(() => {
    logEvent({ event: LogEvent.InstallPageFailed });
    return plainResponse({ body: SERVER_ERROR_TEXT, status: HttpStatus.InternalServerError });
  });
  return route;
}
