# 0010. Public docs on Mintlify

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: the owner's request that the plan include Mintlify docs

## Context

Developers install zapbip by pasting a prompt, and they need a reference for every MCP tool, every message kind, the 24-hour window and each client's setup. The repository's `docs/` folder is internal: ADRs, features, learnings and scenarios.

## Decision

1. The public docs site lives in `apps/docs` as a Mintlify project (`docs.json` + MDX).
2. Each feature ships its pages in the same change as its code.
3. `mint broken-links` runs in `pnpm verify` when `apps/docs/**` changes.
4. The site runs locally with `mint dev`. Publishing waits for the owner to connect the repository to a Mintlify account.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Mintlify in `apps/docs` (chosen) | MCP-friendly docs, API reference, hosted for free on the starter plan | an external service and account | — |
| Markdown in `docs/` on GitHub | no service | mixes public and internal docs; no search or navigation | public docs are a product surface |
| No public docs yet | less work | the install prompt and the tool reference have nowhere to live | the owner asked for it |

## Consequences

- Every feature's definition of done includes its pages.
- The owner creates the Mintlify account. Agents never do.

## Evidence

- The owner's instruction of 2026-11-06.

## Revisit when

- Mintlify's free plan stops covering the site.
