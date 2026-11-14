# 0052. Structured data is one JSON-LD graph built from the same copy and constants as the page

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner, delegated 2026-11-13); Claude (advisor)
- Inspired by: the owner's words of 2026-11-13 ("make SEO, GEO, Open Graph, ld+json scripts impeccable"); [ADR 0041](0041-the-public-site-is-served-by-the-api-worker-through-host-dispatch.md) and the strict policy of `site-policy.ts`

## Context

Search and answer engines read the page, its JSON-LD and the llms files. A fact stated three times (price, agents, definition) drifts when each copy is typed by hand, and a block that disagrees with the visible page can lose rich results. The CSP allows no inline script.

## Decision

Each indexable page carries one `<script type="application/ld+json">` holding a single `@graph`, built by `structured-data.ts` from `SITE_COPY`, the pricing constants, the agent registry and `COMPANY`; the FAQ nodes reuse `faqItemsOf()` and the same rendered text. A JSON-LD block is data, not script: browsers do not execute it, `script-src` does not apply, and the CSP stays unchanged. The serializer escapes `<`, `>` and `&`. The "About zapbip" block of the llms files and the home twin comes from the same `aboutFactsOf`, and a unit test compares the key facts across outputs.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| One script per type | Smaller blocks | Cross references need `@id` anyway | One graph reads as one document |
| Hand-written JSON files | Simple | Drift from the copy and the prices | The test would have to compare strings typed twice |
| Microdata in the HTML | No extra block | Couples markup to schema, hard in eight languages | Search engines prefer JSON-LD |

## Consequences

A new language needs only its copy. A price change moves the page, the JSON-LD and the llms files together.

## Evidence

`apps/api/test/unit/structured-data.test.ts`, `apps/api/test/unit/site-about-facts.test.ts`, `apps/api/e2e/landing/landing-seo.spec.ts`.

## Revisit when

A search engine starts rejecting the `PreOrder` availability of the Pro offer, or billing opens.
