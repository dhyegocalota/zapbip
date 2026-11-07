# Tester briefing: Test timeouts under load

Not applicable: tooling lane. The proof is `tools/repository-shape/src/test-timeouts.test.ts` and one `pnpm verify all` from this worktree.

## Red today, green after

- `test-timeouts.test.ts`: red in e2bb1b8 (`tt-red.log`: 11 failed, 2 passed) on the Vitest configurations without `testTimeout` and `hookTimeout` and on `libs/core` and `libs/types` without a default configuration; green in 35fefe4 (`tt-green.log`: 15 passed).

## Gaps

- No Playwright configuration exists on `main`; two probe cases prove the rule, and `origin/feat/docs-experience` must comply when it merges `main`.
- Other bare `vi.waitFor` calls keep Vitest's 1 s default.
