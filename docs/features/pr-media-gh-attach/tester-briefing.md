# Tester briefing: PR media through the GitHub CLI

Not applicable: tooling lane. The proof is `scripts/pr-media.test.sh`, `hooks.test.sh` and `pr-media-flow.test.ts`.

## Red today, green after

- The doctor tests for `gh` 2.71.0, 2.99.0 and 2.100.0 are new; the script test replaces the Orca fakes with a fake `gh`.

## Gaps

- The live upload is unproven until `gh` is upgraded on a machine that can run it.
