# Tester briefing: Agentic site

## What changed and where

| Area | Paths |
|---|---|
| Markdown renderer, negotiation, twins | `apps/api/src/site/markdown-document.ts`, `markdown-negotiation.ts`, `markdown-pages.ts`, `page-twins.ts`, `agentic-paths.ts` |
| llms files, robots | `llms-files.ts`, `robots-and-sitemap.ts` |
| Discovery and read endpoints | `well-known-documents.ts`, `catalog-routes.ts`, `agentic-routes.ts` (mounted in `site-app.ts`) |
| Request access | `request-access-route.ts`, `agentic-answer.ts`, `join-waitlist.ts` (takes `source`), `migrations/0013_waitlist_source.sql`, `WaitlistSource` in `libs/types` |
| WebMCP | `site-webmcp-script.ts` (embedded in `site-scripts.ts`) |
| Shared with the views | `quick-start-entries.ts`, `faq-items.ts`, `pricing-features.ts`; head link in `views/site-layout.tsx`; form name and notice tie in `views/join-block.tsx` |
| Copy | `AgentsTitle`, `AgentsBody` in `site-copy.ts` (en and pt) |

## How to run

- Unit: `pnpm --filter @zapbip/api exec vitest run -c vitest.unit.config.mts test/unit/markdown-document.test.ts test/unit/markdown-negotiation.test.ts test/unit/site-webmcp-script.test.ts`
- Integration: `test/integration/site-agentic-twins.test.ts`, `site-agentic-discovery.test.ts`, `site-request-access.test.ts`, `site-semantics.test.ts`, plus `join-waitlist.test.ts` for the new `source` argument. Port 4012 (the fake Graph) is shared; two runs at once collide on it.
- E2E: `pnpm --filter @zapbip/api exec playwright test --config playwright.landing.config.ts landing-webmcp.spec.ts`

## Red today, green after

| Test | Red text printed |
|---|---|
| `markdown-document.test.ts`, `markdown-negotiation.test.ts` | `renderMarkdown is not implemented for N blocks`, `prefersMarkdown is not implemented for <accept>` |
| `site-agentic-twins.test.ts` | `expected 404 to be 200`, `expected 'text/html; charset=UTF-8' to be 'text/markdown; charset=utf-8'`, the head link and `Vary` assertions, the robots pattern |
| `site-agentic-discovery.test.ts` | `SyntaxError: Unexpected token '<', "<html lang"... is not valid JSON` (the 404 page) |
| `site-request-access.test.ts` | `expected 404 to be 422`, `expected 404 to be 415`, `expected [ 404, 404, 404, 404 ] to deeply equal [ 200, 200, 200, 429 ]` |
| `site-semantics.test.ts` | three failures: the form name, the `id="join-notice"` notice and its `aria-describedby` |
| `landing-webmcp.spec.ts` | written red, not run before the implementation (the dev stack is heavy on this machine); it went green with the script |

Pins (green when they landed): the landmark, heading, alt, button-name, label and `lang` checks of `site-semantics.test.ts`, the "Markdown twins keep up with the page copy" drift test, and `site-webmcp-script.test.ts`.

## Hypotheses for the tester

1. Every twin path answers Markdown; `Accept` with `text/markdown` ranked above `text/html` answers the twin of the page; a browser `Accept`, `*/*` and no header answer HTML; both carry `Vary: Accept`.
2. A new language added to `OwnerLocale` (and its copy) gets its twins and its llms pair with no new file.
3. `POST /api/request-access` from one address is refused on the fourth call within a minute, and one email on the third, in production limits (30 per minute per key, weights 10 and 15). The form's counters (`join:`) are untouched.
4. A duplicate and a new email answer the same body; no `referred_by` is ever written; no Turnstile call is made.
5. With the Turnstile secret blank, both the form and the agent path write nothing.
6. WebMCP: with `document.modelContext` present the four tools register; with only `navigator.modelContext` they still do; with neither, nothing throws. `switch_language` goes through the footer language form, so the language cookie is set.
7. The head of every indexable page names its twin; the 404 page does not.
8. `security.txt` always expires one year after the request.

## Gaps and notes

- The declarative WebMCP form attributes are not implemented: the specification excludes them and the form needs a captcha (ADR 0044).
- The agent card is a discovery document, not an A2A message endpoint.
- The backoffice export does not show `source` yet (another lane); the column exists.
- The Markdown twins of the home page list the sections by key tables in `markdown-pages.ts`; the drift test fails when a section title, body, question or answer of the pages is missing from the twin, but a new section type needs a manual addition.
- Pre-existing, not from this lane: `landing-quick-start.spec.ts:365` expects `white-space: pre` and the page answers `pre-wrap` since site-polish.
- Docs host (curl, 2026-11-13): `/llms.txt`, `/llms-full.txt`, `/.well-known/mcp.json`, `/.well-known/mcp/server-card.json` answer 200 and `/mcp` answers 405 to a GET (an MCP endpoint). The site llms files link all three.
- The WebMCP specification in force puts the interface on `document.modelContext` (`registerTool(tool, { signal })`); the brief named `navigator.modelContext`, kept as a fallback.
