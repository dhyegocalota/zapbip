# 0044. An agent requests access without the captcha, under weighted limits

- Status: Accepted
- Date: 2026-11-13
- Deciders: Dhyego Calota (owner, delegated 2026-11-13); Claude (advisor)
- Inspired by: the owner's order of 2026-11-13 ("ABSOLUTELY THE WHOLE EXPERIENCE MUST BE AGENTIC"); [ADR 0039](0039-the-public-waitlist-is-guarded-by-turnstile-and-fails-closed.md) (Turnstile fails closed); [ADR 0040](0040-the-waitlist-and-the-referral-cap-live-in-d1-and-the-cap-is-a-settings-row.md) (the waitlist in D1); [ADR 0041](0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md) (host dispatch); the WebMCP explainer at `webmachinelearning/webmcp` (checked 2026-11-13, last commit 2026-11-13); llmstxt.org; the A2A agent card (`/.well-known/agent-card.json`); RFC 9116 (`security.txt`)

## Context

The site has one write path, the waitlist form, and a captcha guards it because a person is expected on the other side. An agent acting for a person cannot solve a captcha, so "an agent can do everything on behalf of a human" stops at the first button. The site also has no machine-readable face: no Markdown, no llms files, no discovery documents, no tools a browser agent can call.

## Decision

1. **Markdown twins and llms files.** Every HTML page has a twin at its path plus `.md` and answers Markdown when `Accept` ranks `text/markdown` above `text/html`. `/llms.txt` and `/llms-full.txt` exist for the site and, under each language path, for every locale in `OwnerLocale`. All of them are rendered from `SITE_COPY`, `legalTextOf` and the agent registry, so there is no second source of truth and a new language appears with its copy.
2. **WebMCP, imperative only.** The first-party script registers four tools through `document.modelContext.registerTool()`, the interface of the specification in force on 2026-11-13; when only `navigator.modelContext` exists (the earlier drafts) it uses that one. A tool returns `{ content: [{ type: 'text', text }] }`. The declarative form attributes are not part of the specification ("being explored separately"), and the join form could not use them anyway because its submission needs a Turnstile token, so the form carries no tool attributes.
3. **Discovery.** `/.well-known/mcp.json` and `/.well-known/mcp/server-card.json` (the two shapes the docs host already serves), `/.well-known/agent-card.json` (an A2A card describing four skills; it is a discovery document: the skills run over the site's JSON endpoints, not over A2A messages), `/.well-known/security.txt` (generated, `Expires` a year after the request) and a `robots.txt` that names the AI crawlers.
4. **A captcha-free request path with weighted limits.** `POST /api/request-access` runs the same `joinWaitlist` use case with source `agent`, no Turnstile and no referral credit. Because the binding `INSTALL_PAGE_LIMITER` has one fixed limit (30 per minute per key), "stricter" is done by weight: an agent request spends `AGENT_ADDRESS_WEIGHT` (10) units of the address key and `AGENT_EMAIL_WEIGHT` (15) units of the email key, so one address gets 3 requests and one email 2 per minute. The keys use the prefix `agent:`, so the form's counters never meet. A migration (`0013`) adds `landing_waitlist.source`.
5. The agent path follows the same pause as the form: no Turnstile secret means no signups, so one switch closes both.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep Turnstile for agents (a challenge token the agent forwards from a person) | no spam trade-off | an agent cannot get a token without a person; defeats the goal | the owner wants the agent to act alone |
| A signed proof of work in place of the captcha | no third party | more code, a new protocol agents do not speak | weighted limits are enough for a list that only costs a row |
| A new limiter binding for the agent path | exact limits | wrangler namespace per environment, a deploy change | weights on the existing binding need no deploy change |
| A global hourly cap on agent rows in D1 | bounds the worst case | a flood locks real agents out | per-address and per-email weights degrade per attacker |
| Declarative WebMCP form attributes | no script | not in the specification; the form needs a captcha | imperative tools call the JSON endpoint |
| Markdown only through `Accept` | one URL | caches and crawlers cannot ask for a header | both: the `.md` path and the header |

## Consequences

The waitlist can now be filled by a script that rotates addresses and emails: each address costs three rows a minute. The trade-off is accepted because a row is cheap, a duplicate writes nothing, the rows carry `source = 'agent'` so the owner can filter or purge them, and the export and the release of access are the human gates. A source column was added instead of a table so the backoffice export can show it later (not done in this lane). Enumeration is closed: a new and a duplicate email answer the same body. The weights are constants in `site-constants.ts`; if the binding limit changes, the effective limits scale with it.

## Evidence

`apps/api/test/integration/site-agentic.test.ts` (routes, negotiation, request path with limits), `apps/api/test/unit/markdown-document.test.ts`, `apps/api/e2e/landing/landing-webmcp.spec.ts`. The docs host serves `/llms.txt`, `/llms-full.txt`, `/.well-known/mcp.json`, `/.well-known/mcp/server-card.json` and an MCP endpoint at `/mcp` (curl, 2026-11-13).

## Revisit when

The declarative WebMCP API enters the specification; a rate-limit binding with a cost parameter exists; the first non-human row floods the list; a real A2A endpoint is built.
