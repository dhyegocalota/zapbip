# 0044. An agent requests access without the captcha, under weighted limits

- Status: Accepted
- Date: 2026-11-13
- Deciders: Dhyego Calota (owner, delegated 2026-11-13); Claude (advisor)
- Inspired by: the owner's order of 2026-11-13 ("ABSOLUTELY THE WHOLE EXPERIENCE MUST BE AGENTIC"); [ADR 0039](0039-the-public-waitlist-is-guarded-by-turnstile-and-fails-closed.md) (Turnstile fails closed); [ADR 0040](0040-the-waitlist-and-the-referral-cap-live-in-d1-and-the-cap-is-a-settings-row.md) (the waitlist in D1); [ADR 0041](0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md) (host dispatch); the WebMCP explainer at `webmachinelearning/webmcp` (checked 2026-11-13, last commit 2026-11-13); llmstxt.org; the A2A agent card (`/.well-known/agent-card.json`); RFC 9116 (`security.txt`)

## Context

The site has one write path, the waitlist form, and a captcha guards it because a person is expected on the other side. An agent acting for a person cannot solve a captcha, so "an agent can do everything on behalf of a human" stops at the first button. The site also has no machine-readable face: no Markdown, no llms files, no discovery documents, no tools a browser agent can call.

## Decision

1. **Markdown twins and llms files.** Every HTML page has a twin at its path plus `.md` and answers Markdown when `Accept` ranks `text/markdown` above `text/html`. `/llms.txt` and `/llms-full.txt` exist for the site and, under each language path, for every locale in `OwnerLocale`. All are rendered from `SITE_COPY`, `legalTextOf` and the agent registry, so there is no second source of truth and a new language appears with its copy. The home page shows the agents section the twin ends with.
2. **WebMCP, imperative only.** The first-party script registers four tools through `document.modelContext.registerTool()`, the interface of the specification in force on 2026-11-13; when only `navigator.modelContext` exists (the earlier drafts) it uses that one. A tool returns `{ content: [{ type: 'text', text }] }`, with `isError` set when the answer is not ok, not JSON or never arrived. The declarative form attributes are not part of the specification ("being explored separately"), and the join form could not use them anyway because its submission needs a Turnstile token.
3. **Discovery.** `/.well-known/mcp.json` and `/.well-known/mcp/server-card.json`, `/.well-known/agent-card.json` (an A2A card describing four skills; a discovery document, the skills run over the site's JSON endpoints), `/.well-known/security.txt` (generated, `Expires` 180 days after the request, `Policy` omitted while `IS_SECURITY_POLICY_PUBLIC` is false because the repository is private; flip it with the repository) and a `robots.txt` naming the AI crawlers.
4. **A captcha-free request path, protected by ceilings that do not depend on the attacker's cooperation.** `POST /api/request-access` runs the same `joinWaitlist` use case with source `agent`, no Turnstile and no referral credit. The rows go into the D1 database shared with accounts and the directory, so protecting it ranks above never refusing an agent. In the order they run:
   - the address key, weighted: an agent request spends `AGENT_ADDRESS_WEIGHT` (10) units of `agent:address:<key>` on `INSTALL_PAGE_LIMITER`, whose limit is 30 a minute per key (3 requests). IPv6 is keyed at the /48, not the /64 of the form, because one /48 holds 65,536 /64 networks;
   - a global key, `agent:all`, `AGENT_GLOBAL_WEIGHT` (1) unit: at most 30 agent requests a minute from everywhere, so a swarm of addresses meets a ceiling;
   - the pause shared with the form (no Turnstile secret, no signups), the exact media type `application/json`, a body of at most `AGENT_BODY_MAX_BYTES` (1 KiB, `413`), the language and the email shape;
   - the email key, weighted `AGENT_EMAIL_WEIGHT` (15), keyed by the SHA-256 of the normalized email so no address enters a limiter key (2 requests);
   - the hourly row cap: when `AGENT_HOURLY_ROW_CAP` (200) rows with source `agent` were written in the last hour (an index on `source, created_at`), the answer is `429` `capacity_reached` with `Retry-After: 3600`, and nothing is written.
5. **A person is never locked out by an agent row.** A form join meeting a row written by an agent takes it over (source and language follow, the referral code stays); an agent never takes over a form row. A new migration (`0013`) adds `landing_waitlist.source` and the index.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep Turnstile for agents | no spam trade-off | an agent cannot get a token without a person | defeats the goal |
| Per-address and per-email weights only | no state in D1 | an IPv6 /48 gives 65,536 networks and the email key is free to rotate: about 196,000 rows a minute into the shared database | the first version; refused in review |
| A global hourly cap only | bounds the worst case | no per-attacker fairness; one address spends the whole cap | kept as the second layer, not the only one |
| A new limiter binding for the agent path | exact limits | a namespace per environment, a deploy change | weights on the existing binding need no deploy change |
| Declarative WebMCP form attributes | no script | not in the specification; the form needs a captcha | imperative tools call the JSON endpoint |
| Markdown only through `Accept` | one URL | caches and crawlers cannot ask for a header | both: the `.md` path and the header |

## Consequences

The worst case is bounded: 200 agent rows an hour, 30 requests a minute, whatever the number of addresses or emails. The price is that a flood can lock honest agents out until the hour turns (`Retry-After: 3600`); people using the form are never affected, because the form has its own counters and the cap counts only agent rows. Rows carry `source = 'agent'`, so the owner can filter or purge them and the release of access can leave them out by default. Enumeration is closed: a new and a duplicate email answer the same body. The weights and the cap are constants in `site-constants.ts`; if the binding limit changes, the effective limits scale with it. The shared `clientRateKey` takes an optional prefix length; the other routes keep the /64.

## Evidence

`apps/api/test/integration/site-agentic-twins.test.ts`, `site-agentic-discovery.test.ts` and `site-request-access.test.ts` (routes, negotiation, the request path with its ceilings), `join-waitlist.test.ts` (the takeover), `apps/api/test/unit/markdown-document.test.ts`, `markdown-negotiation.test.ts`, `site-webmcp-script.test.ts` and `apps/api/e2e/landing/landing-webmcp.spec.ts`. The docs host serves `/llms.txt`, `/llms-full.txt`, `/.well-known/mcp.json`, `/.well-known/mcp/server-card.json` and an MCP endpoint at `/mcp` (curl, 2026-11-13).

## Revisit when

The declarative WebMCP API enters the specification; a rate-limit binding with a cost parameter exists; the hourly cap is reached by honest agents; the repository becomes public (add `Policy`); a real A2A endpoint is built.
