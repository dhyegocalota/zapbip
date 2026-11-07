# Tester briefing: Test timeouts under load

Not applicable: tooling lane. The proof is `tools/repository-shape/src/test-timeouts.test.ts` and one `pnpm verify all` from this worktree.

## Red today, green after

- `test-timeouts.test.ts`: red on the Vitest configurations without `testTimeout` and `hookTimeout` and on `libs/core` without a default configuration; green after the fix.

## Gaps

- No Playwright configuration exists on `main`; the Playwright cases are empty until one lands.
