# Tester briefing: Preflight pre-launch

## What changed

- `apps/api/src/operations/deploy-preflight.ts` — the Worker preflight drops the official number check and warns on an absent npm package.
- `apps/api/src/operations/deploy-preflight.ts` — an absent version (`E404`) queries the bare package name: absent too is a warning, a foreign maintainer or publisher or an unreadable answer refuses, and an owned name still reports the version as unpublished. Warnings are typed (`PreflightWarningKind.PackageUnpublished`).
- `apps/api/scripts/deploy.ts` — wires `warn` to `log` and prints the collected warnings again under `warnings to resolve before launch:` after the smoke test, pass or fail; drops the number from the run input.
- `docs/runbooks/deploy.md`, `docs/runbooks/mintlify-publish.md` — wording.

## How to run

```bash
pnpm --filter @zapbip/api exec vitest run test/unit/deploy-preflight.test.ts test/unit/deploy-entry.test.ts
```

## Red today, green after

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| `deploy-preflight.test.ts` (number unset, E404), `feaee3d5` | the Worker preflight refused both; run printed 3 failures (named, assertion text not kept) | neither is a Worker refusal |
| `deploy-preflight.test.ts` (foreign maintainer on the name, network error on the name), `deploy-entry.test.ts` (reprint), `644338ce` | 3 failed: the foreign maintainer warned instead of refusing, the network error was not refused, the warning printed once (assertion text not kept) | the bare name is queried; the reprint exists |
| `deploy-preflight.test.ts` (version absent, name owned), `docs-preflight-entry.test.ts` (same), `e99db149` | 2 failed: `AssertionError: expected [] to deep equally contain { kind: 'package unpublished', … }` and `AssertionError: expected +0 to be 1` | an owned name still reports the version as unpublished |
| `deploy-preflight.test.ts` (sole foreign maintainer), `feaee3d5` | pin: green when it landed | n/a |
| `deploy-preflight.test.ts` (docs E404 on both), `644338ce` | pin: green when it landed; mutating the docs handler to `() => null` turns it red | n/a |
| `deploy-entry.test.ts` (reprint when the smoke test fails), `e99db149` | pin: green when it landed; reprinting only on a passing smoke test turns it red | n/a |

## Hypotheses to attack

1. Hypothesis: a squatted package still blocks. Break it by: a maintainer list without the publisher, and an `_npmUser` answer from someone else.

## Known gaps

- The docs preflight keeps the single official number until its own feature.
