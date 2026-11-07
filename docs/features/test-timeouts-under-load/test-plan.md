# Test plan: Test timeouts under load

Logs live in the scratchpad `.../scratchpad/` (`tt-*.log`).

## The failing test first

- [x] `tools/repository-shape/src/test-timeouts.test.ts` — input: the tracked configurations before the fix; expected: red on every Vitest configuration missing `testTimeout` or `hookTimeout` and on the packages with no default configuration — evidence: e2bb1b8, `tt-red.log`: 11 failed, 2 passed, `RED EXIT 1`, first failure text `AssertionError: expected false to be true` at `test-timeouts.test.ts:42` for `libs/core` and `libs/types`

## Unit

- [x] Every `vitest*.config.*` sets `testTimeout` and `hookTimeout` as named `_MS` constants — evidence: 35fefe4, `tt-green.log`: 15 passed, `GREEN EXIT 0`
- [x] Every package whose script runs `vitest` without `--config` (`libs/core`, `libs/types`) has a `vitest.config.*` — evidence: 35fefe4 and the follow-up commit, same log
- [x] Probe: a Playwright configuration string with all four timeouts reports nothing missing — evidence: `test-timeouts.test.ts`, `tt-verify3.log` shape step
- [x] Probe: a Playwright configuration string whose only timeout is `expect.timeout` reports `['timeout']` (the top-level key is anchored) — evidence: same log
- [x] Every `playwright*.config.*` on this branch sets the four timeouts — evidence: no such file on `main`; `origin/feat/docs-experience` carries `apps/docs/playwright.config.ts` and complies when it merges `main`
- [x] `libs/core` unit passes under load, including `evaluate-pollers.test.ts` — evidence: `tt-core.log`: 73 files, 1019 tests passed, `CORE EXIT 0`; `tt-verify.log` unit step: 1019 passed

## Integration

- [x] `apps/api` integration under load — evidence: first `pnpm verify all` (`tt-verify.log`): 776 passed, 2 failed; both failures were the 1 s default `waitFor` in `mcp-tools.test.ts` (`heldQuestionId`), rows 409 and 410 of `mcp-outbound.test.ts` passed; fixed, then the final `pnpm verify all` (`tt-verify3.log`)

## Edge cases

- [x] A timeout in a row of `mcp-outbound.test.ts` or `mcp-tools.test.ts` — input: the test is abandoned with calls in flight; expected: `afterEach` settles the in-flight calls before `reset`, so no later test sees `no such table: connections` — evidence: the hooks in both files; no timeout reproduced after the fix

## Coverage honesty

- No real Playwright configuration exists on `main`; the Playwright half is proven by the two probe cases only.
- The load-induced failures never reproduced on demand; the fix is hardening by analysis. Other bare `vi.waitFor` calls (default 1 s) remain in `apps/api` integration and `apps/connector` unit tests; they did not fail in the runs above and are left for a follow-up.
