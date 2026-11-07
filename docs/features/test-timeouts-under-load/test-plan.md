# Test plan: Test timeouts under load

## The failing test first

- [x] `tools/repository-shape/src/test-timeouts.test.ts` — input: the tracked configurations before the fix; expected: red on every Vitest configuration missing `testTimeout` or `hookTimeout` and on `libs/core` having no default configuration — evidence: red commit on this branch

## Unit

- [x] Every `vitest*.config.*` sets `testTimeout` and `hookTimeout` as named `_MS` constants — evidence: green shape test
- [x] Every package whose script runs `vitest` without `--config` has a `vitest.config.*` — evidence: green shape test
- [x] Every `playwright*.config.*` sets `timeout`, `expect.timeout`, `use.navigationTimeout` and `use.actionTimeout` as named `_MS` constants — evidence: no such file on `main`, the case list is empty today

## Integration

- [x] `apps/api/test/integration/mcp-outbound.test.ts` rows 409 and 410 and `libs/core` `evaluate-pollers.test.ts` pass under load — evidence: one `pnpm verify all` from this worktree

## Edge cases

- [x] A timeout in a row of `mcp-outbound.test.ts` — input: the row is abandoned; expected: `afterEach` settles the in-flight calls before `reset`, so no later test sees `no such table: connections` — evidence: reading the hook, no timeout reproduced after the fix

## Coverage honesty

- The Playwright assertions have no configuration to run against until one is merged.
- The load-induced failures never reproduced on demand; the fix is hardening by analysis.
