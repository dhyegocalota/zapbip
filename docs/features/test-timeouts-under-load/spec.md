# Test timeouts under load

**Status:** In review
**Tier:** 🟢 small
**Owner approval:** approved 2026-11-07 (owner delegated)
**ADRs:** none
**Not changing:** product code under `apps/*/src` and `libs/*/src`

## Problem

On a loaded machine (load 40 to 100) Vitest's default 5 s test timeout fired in tests that assert nothing about time: `libs/core` `evaluate-pollers.test.ts` ("the failure kind is logged") and `apps/api` `mcp-outbound.test.ts` rows 409 and 410 (30 and 31 sequential MCP calls in one test). When a timeout fired, `afterEach(reset)` wiped D1 under the abandoned calls and later tests failed with `no such table: connections`. A docs walk also hit a `page.goto` timeout at load around 90.

## Goals

- Every Vitest configuration sets `testTimeout` and `hookTimeout` as named millisecond constants sized for a loaded machine.
- `libs/core` and `libs/types` get a Vitest configuration, since they had none and ran Vitest on the defaults.
- Every Playwright configuration sets `timeout`, `expect.timeout`, `use.navigationTimeout` and `use.actionTimeout` as named constants. None exists on `main` today; the shape test covers the first one that lands.
- `mcp-outbound.test.ts` and `mcp-tools.test.ts` wait for their in-flight calls before `reset`, so a timeout cannot cascade into other tests.
- The held-question poll in `mcp-tools.test.ts` (Vitest's `waitFor` defaults to 1 s) waits half of the held ask's lifetime, so a slow poll fails as "not stored" instead of racing the ask's expiry. The first `pnpm verify all` under load failed on exactly this poll in two tests.

## Non-goals

- Changing a test that asserts real timing: it keeps its own explicit bound.

## Design

### Data flow

`tools/repository-shape/src/test-timeouts.test.ts` lists the tracked Vitest and Playwright configurations and each package that runs `vitest` without `--config`, and asserts the settings by name. The unit configurations use `LOADED_MACHINE_TEST_TIMEOUT_MS` (30 s); end-to-end and packaging configurations use `LOADED_MACHINE_END_TO_END_TIMEOUT_MS` (120 s). Constants are local to each package because `apps/connector` and `apps/openclaw-plugin` do not depend on `@zapbip/types`.

### Failure handling

A test that exceeds the bound still fails; the bound only stops the machine from being measured. `mcp-outbound.test.ts` registers each call sequence and `afterEach` settles them before `reset`.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| One shared constant or one per package | shared in `libs/types`, local | local, two packages do not depend on `libs/types` (owner delegated) | 2026-11-07 |

## Test strategy summary

Unit: the shape test (red first on the missing settings and the missing `libs/core` configuration). Proof: `libs/core` unit and the `apps/api` integration suite inside one `pnpm verify all` under load.
