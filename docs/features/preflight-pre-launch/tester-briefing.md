# Tester briefing: Preflight pre-launch

## What changed

- `apps/api/src/operations/deploy-preflight.ts` — the Worker preflight drops the official number check and warns on an absent npm package.
- `apps/api/scripts/deploy.ts` — wires `warn` to `log`, drops the number from the run input.
- `docs/runbooks/deploy.md`, `docs/runbooks/mintlify-publish.md` — wording.

## How to run

```bash
pnpm --filter @zapbip/api exec vitest run test/unit/deploy-preflight.test.ts test/unit/deploy-entry.test.ts
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `deploy-preflight.test.ts` (number unset, E404) | the Worker preflight refused both | neither is a Worker refusal |

## Hypotheses to attack

1. Hypothesis: a squatted package still blocks. Break it by: a maintainer list without the publisher, and an `_npmUser` answer from someone else.

## Known gaps

- The docs preflight keeps the single official number until its own feature.
