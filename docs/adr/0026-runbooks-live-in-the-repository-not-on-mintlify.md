# 0026. Runbooks live in the repository, not on Mintlify

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: [ADR 0010](0010-public-docs-on-mintlify.md), which keeps `docs/` internal and makes `apps/docs` the public product surface; the owner's request of 2026-11-06 for a documented sequence to go live

## Context

Going live means following steps in Cloudflare, Meta, DNS and Mintlify. The steps name resources, routes and secrets that must match `apps/api/wrangler.jsonc` and the secrets list, so they change whenever that configuration changes. The owner follows them by hand, step by step.

## Decision

1. Runbooks live in `docs/runbooks/`, beside the ADRs and the features. A change to the configuration they describe updates them in the same pull request.
2. They are followed step by step, so they never take the docs lane ([HARNESS section 1](../../.claude/HARNESS.md)). They are reviewed like code.
3. They are not published. The Mintlify site stays the public product docs.
4. The repository-shape indexes list every runbook, so a missing link fails a test.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| `docs/runbooks/` in the repository (chosen) | versioned with the configuration; reviewed in the same pull request; links checked by tests | not visible to visitors; owner-facing | — |
| Mintlify "Self-hosting / Operations" section | searchable; rendered like the rest of the docs | publishes operator steps to every visitor; the Mintlify publish runbook would itself be public; a second publish step per change | the product docs are for developers who use zapbip, not for its operator |
| A wiki or a shared document outside the repository | easy to edit | drifts from the configuration; no review; outside the harness | the drift is the risk this slice removes |

## Consequences

- Every runbook link is a repository-shape test target.
- If zapbip ever offers self-hosting, that feature publishes a copy of the runbooks in `apps/docs`.

## Evidence

- The owner's request of 2026-11-06.
- [ADR 0010](0010-public-docs-on-mintlify.md): `docs/` is internal, public docs are a product surface.

## Revisit when

- zapbip offers self-hosting to developers.
- Mintlify cannot publish from a subdirectory of the repository, so the publish runbook has to move (see the risks in the `deploy-readiness` spec).
