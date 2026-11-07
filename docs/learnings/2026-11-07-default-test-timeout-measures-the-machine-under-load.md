# A test that asserts no timing fails with a 5 s timeout and then later tests fail with `no such table`

- Date: 2026-11-07
- Inspired by: `evaluate-pollers.test.ts` and `mcp-outbound.test.ts` rows 409 and 410 failing in `pnpm verify all` at load 40 to 100
- Revisited: 2026-11-07 — still true

## Signal
A test with 30 sequential calls reports `Test timed out in 5000ms`, and tests after it in the same file fail with `no such table: connections`.

## Cause
Vitest's default `testTimeout` and `hookTimeout` are 5 s. A busy machine stretches an ordinary test past that. The abandoned test keeps awaiting calls while `afterEach(reset)` wipes D1 under them, and the next test inherits the wreckage.

## Do
Set `testTimeout` and `hookTimeout` explicitly in every Vitest configuration, and the four timeouts in every Playwright configuration, as named constants; a test that asserts real timing keeps its own bound. A hook that resets shared state first settles the work the test left in flight. The `test-timeouts.test.ts` shape test fails when a configuration lacks them.

## Anchor
`tools/repository-shape/src/test-timeouts.test.ts`, `apps/api/test/integration/mcp-outbound.test.ts`, `docs/features/test-timeouts-under-load/`
