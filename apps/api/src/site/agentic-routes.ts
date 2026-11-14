import { HttpStatus, WebLocale } from '@zapbip/types';
import { Hono } from 'hono';
import { LlmsFile, llmsPathOf, setupPathOf } from './agentic-paths';
import { jsonResponse } from './agentic-answer';
import { pricingHandler, quickStartHandler } from './catalog-routes';
import { llmsFullTextOf, llmsTextOf } from './llms-files';
import { markdownResponse, markdownTwinRoutes } from './page-twins';
import { requestAccessHandler } from './request-access-route';
import { setupMarkdownOf } from './setup-markdown';
import { MARKDOWN_CONTENT_TYPE, PAGE_CACHE_CONTROL, PAGE_VARY, TEXT_CONTENT_TYPE } from './site-constants';
import type { SiteEnv } from './site-env';
import { SitePath } from './site-paths';
import { agentCardOf, mcpDiscoveryOf, mcpServerCardOf, securityTextOf } from './well-known-documents';

const DOCUMENT_HEADERS = { 'Cache-Control': PAGE_CACHE_CONTROL, Vary: PAGE_VARY };
const LLMS_RENDERERS = {
  [LlmsFile.Summary]: llmsTextOf,
  [LlmsFile.Full]: llmsFullTextOf,
};

export const agenticRoutes = new Hono<SiteEnv>();

Object.values(WebLocale).forEach((locale) =>
  Object.values(LlmsFile).forEach((file) =>
    agenticRoutes.get(llmsPathOf({ locale, file }), (context) =>
      context.body(LLMS_RENDERERS[file]({ origin: context.env.SITE_ORIGIN, locale }), HttpStatus.Ok, {
        'Content-Type': TEXT_CONTENT_TYPE,
        ...DOCUMENT_HEADERS,
      }),
    ),
  ),
);

Object.values(WebLocale).forEach((locale) =>
  agenticRoutes.get(setupPathOf({ locale }), (context) =>
    context.body(setupMarkdownOf({ origin: context.env.SITE_ORIGIN, locale }), HttpStatus.Ok, {
      'Content-Type': MARKDOWN_CONTENT_TYPE,
      ...DOCUMENT_HEADERS,
    }),
  ),
);

markdownTwinRoutes().forEach(({ path, twin }) => agenticRoutes.get(path, (context) => markdownResponse({ context, twin })));

agenticRoutes.get(SitePath.McpDiscovery, (context) =>
  jsonResponse({
    context,
    body: mcpDiscoveryOf({ publicOrigin: context.env.PUBLIC_ORIGIN }),
    status: HttpStatus.Ok,
    headers: DOCUMENT_HEADERS,
  }),
);
agenticRoutes.get(SitePath.McpServerCard, (context) =>
  jsonResponse({
    context,
    body: mcpServerCardOf({ publicOrigin: context.env.PUBLIC_ORIGIN }),
    status: HttpStatus.Ok,
    headers: DOCUMENT_HEADERS,
  }),
);
agenticRoutes.get(SitePath.AgentCard, (context) =>
  jsonResponse({ context, body: agentCardOf({ origin: context.env.SITE_ORIGIN }), status: HttpStatus.Ok, headers: DOCUMENT_HEADERS }),
);
agenticRoutes.get(SitePath.SecurityText, (context) =>
  context.body(securityTextOf({ origin: context.env.SITE_ORIGIN, now: Date.now() }), HttpStatus.Ok, {
    'Content-Type': TEXT_CONTENT_TYPE,
    ...DOCUMENT_HEADERS,
  }),
);
agenticRoutes.get(SitePath.Pricing, pricingHandler);
agenticRoutes.get(SitePath.QuickStart, quickStartHandler);
agenticRoutes.post(SitePath.RequestAccess, requestAccessHandler);
