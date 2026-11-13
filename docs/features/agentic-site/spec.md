# Agentic site

**Status:** Building
**Tier:** 🔴 structural (a write path without a captcha)
**Owner approval:** approved 2026-11-13 (owner delegated; the quote is his words)
**ADRs:** [0044](../../adr/0044-an-agent-requests-access-without-the-captcha-under-weighted-limits.md)
**Not changing:** the human join form, Turnstile, the referral cap and credits, the backoffice, the app, the MCP server

## Problem

The owner, 2026-11-13: "add one more hyper mega important thing: ABSOLUTELY THE WHOLE EXPERIENCE MUST BE AGENTIC, EVERYTHING. So use every technology on the website, app, whatever, so that an agent can do everything on behalf of a human!!!" The site is the first surface: an agent that reads it, or drives a browser on it, cannot today read the content as Markdown, discover what the product offers, or request access, because the only join path needs a human captcha.

## Goals

1. Markdown twins. Every HTML page has a Markdown twin at its path plus `.md` (`/index.md`, `/pt-br.md`, `/terms.md`, `/pt-br/termos.md`, ...), and answers Markdown when `Accept` prefers `text/markdown`. Each page head carries `<link rel="alternate" type="text/markdown">`. The twins are rendered from the copy modules.
2. `/llms.txt` and `/llms-full.txt`, plus `/<language path>/llms.txt` and `/<language path>/llms-full.txt` for every locale, built from the same copy and the same locale list, so a new language appears by itself. They link the docs site's own `llms.txt`, `llms-full.txt` and MCP endpoint.
3. WebMCP. The first-party script registers `request_access`, `get_pricing`, `get_quick_start` and `switch_language` on `document.modelContext` (the interface of the specification in force; `navigator.modelContext` of the earlier drafts when only that exists). Feature-detected, silent when absent.
4. Discovery. `/.well-known/mcp.json`, `/.well-known/mcp/server-card.json`, `/.well-known/agent-card.json`, `/.well-known/security.txt`; `robots.txt` names the AI crawlers and the llms files.
5. A machine path to request access. `POST /api/request-access` with a JSON body, no Turnstile, weighted rate limits per address and per email, source `agent`, never referral credit. `GET /api/pricing` and `GET /api/quick-start` give the other two tools their data.
6. Semantic HTML audit of the site pages, fixing gaps.

## Non-goals

The app and backoffice (their own lanes). A real A2A message endpoint. A declarative WebMCP form (not in the specification, see the ADR). Docs site changes.

## Design

- `markdown-document.ts` renders typed blocks to Markdown. `markdown-pages.ts` builds the blocks of the home page and of each legal page from `SITE_COPY`, `legalTextOf`, the pricing values and the agent registry. `llms-files.ts` builds the llms files from the same pages.
- `agentic-routes.ts` is one Hono sub-app mounted by `createSiteApp`: the llms files per locale, the Markdown twins, the well-known documents, the two read endpoints and `POST /api/request-access`. The twin and negotiation paths come from the same enum and locale lists as the HTML routes.
- `request-access-route.ts` runs, in order: client address (`400`), the weighted address limit (`429`), the JSON body (`415`, `400`), the language (`422`), the email shape (`422`), the weighted email limit (`429`), the paused check (`503`), `joinWaitlist` with source `agent`. A duplicate answers like a new join. Migration `0013` adds `landing_waitlist.source` (`form` default, `agent`).
- `site-webmcp-script.ts` is the WebMCP part of `/site/site.js`. The tools call the three JSON endpoints with `fetch` (`connect-src 'self'` already allows it); `switch_language` posts the preference form and follows the `hreflang` link of the page.

## Interfaces

`POST /api/request-access` `{ "email": string, "language"?: string }` answers `{ "status", "language", "message" }`; `status` is `requested`, `invalid_email`, `unsupported_language`, `invalid_request`, `rate_limited`, `paused` or `unavailable`. `message` is product copy in the requested language.

## Failure modes

| Failure | Signal | Handling |
|---|---|---|
| A bot floods the agent path | rows with source `agent` grow | weighted limits per address and per email; the backoffice sees the source; the path closes with the same pause switch as the form |
| The limiter binding is shared with the form | form users limited by agent traffic | distinct key prefix: counters never meet |
| A cross-site page posts to the endpoint | none | only `application/json` is accepted, and no CORS header is sent, so a browser preflight fails |
| WebMCP absent | none | the script returns before touching anything |
| `security.txt` expiry | the date moves with each request | the file is generated, never stale |

## Open questions

None; the owner delegated every decision.
