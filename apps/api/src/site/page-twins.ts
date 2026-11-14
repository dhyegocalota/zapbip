import { HttpStatus, WebLocale } from '@zapbip/types';
import type { Context, Next } from 'hono';
import { SAFE_METHODS } from '../backoffice/backoffice-constants';
import { markdownPathOf } from './agentic-paths';
import { LEGAL_PAGES, legalPathOf } from './legal-links';
import { homeMarkdownOf, legalMarkdownOf } from './markdown-pages';
import { prefersMarkdown } from './markdown-negotiation';
import { MARKDOWN_CONTENT_TYPE, PAGE_CACHE_CONTROL, PAGE_VARY } from './site-constants';
import type { SiteEnv } from './site-env';
import { localePathOf } from './site-language';

const ACCEPT_HEADER = 'accept';

export type PageTwin = { htmlPath: string; markdownOf: (input: { origin: string }) => string };

export const PAGE_TWINS: PageTwin[] = [
  ...Object.values(WebLocale).map((locale) => ({
    htmlPath: localePathOf({ locale }),
    markdownOf: ({ origin }: { origin: string }) => homeMarkdownOf({ locale, origin }),
  })),
  ...LEGAL_PAGES.map((page) => ({ htmlPath: legalPathOf(page), markdownOf: () => legalMarkdownOf(page) })),
];

export function markdownResponse(input: { context: Context<SiteEnv>; twin: PageTwin }): Response {
  const { context, twin } = input;
  return context.body(twin.markdownOf({ origin: context.env.SITE_ORIGIN }), HttpStatus.Ok, {
    'Content-Type': MARKDOWN_CONTENT_TYPE,
    'Cache-Control': PAGE_CACHE_CONTROL,
    Vary: PAGE_VARY,
  });
}

export function markdownTwinRoutes(): { path: string; twin: PageTwin }[] {
  return PAGE_TWINS.map((twin) => ({ path: markdownPathOf({ htmlPath: twin.htmlPath }), twin }));
}

export async function markdownNegotiation(context: Context<SiteEnv>, next: Next): Promise<Response | void> {
  const twin = PAGE_TWINS.find((candidate) => candidate.htmlPath === new URL(context.req.url).pathname);
  const isNegotiable = SAFE_METHODS.includes(context.req.method) && twin !== undefined;
  if (!isNegotiable || !prefersMarkdown({ accept: context.req.header(ACCEPT_HEADER) })) return next();
  return markdownResponse({ context, twin });
}
