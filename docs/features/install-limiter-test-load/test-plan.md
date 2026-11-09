# Test plan: Install limiter test load

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] `apps/api/test/integration/install-page-attack.test.ts::IS-S1 ... when the window rolls during the loop` — input: wait until 20 ms before a 60 s window boundary, then 33 sequential requests from one address; expected before the fix: `expected 0 to be greater than 0` (no 429). — evidence: at 242a17fc, 3 of 4 runs failed with `expected 0 to be greater than 0` (1 run passed: the 20 ms margin is timing-sensitive against the first request latency), logs scratchpad/red1..3.log

## Unit

- [x] `apps/api/test/unit/rate-limit-window.test.ts` — `msUntilFreshWindow` returns 0 early in a window and when exactly the margin remains, the remaining time when less than the margin remains, and a whole window when the margin exceeds it: 4 of 4. — evidence: 7ad956c1, 4 passed (4)

- [x] `apps/api/test/integration/install-page-attack.test.ts::IS-S1 limits the real binding per client address and answers Retry-After` — expected (amended by the lead to what the tester ran): green three runs in a row, plus the fixed test started 20 ms before a window boundary green 3 of 3 (it waits for the next window). — evidence: at 242a17fc, 3 of 4 runs failed with `expected 0 to be greater than 0` (1 run passed: the 20 ms margin is timing-sensitive against the first request latency), logs scratchpad/red1..3.log
- [x] Audit — expected: no other test of `apps/api/test` asserts a trip of a real ratelimit binding after a loop (`grep -rn "429" apps/api/test`). — evidence: grep -rn 429 apps/api/test: every other 429 assertion uses createFakeRateLimiter or a refusing limiter (install-page.test.ts, backoffice-*), none trips a real binding after a loop

## Coverage honesty

- SL-W16 and SL-W17 of `feat/start-link` are not on `main` yet; they are listed for the same check.

## Edge cases found during execution

- Boundary check: start positioned 20 ms before a window boundary, then `startInFreshWindow` plus the burst: green 3 of 3.
- Mutation A: `msUntilFreshWindow` always returns 0, plus 20 ms boundary positioning: red 3 of 3 (`expected 0 to be greater than 0`). Restored.
- Mutation B: burst back to a sequential loop with 20 ms boundary positioning, no fresh-window wait: red 3 of 3 (`expected 0 to be greater than 0`). Restored.
- F: the red variant at 242a17fc is not deterministic: 1 of 4 runs passed, because the 20 ms margin can elapse before or after the first request; the plan says it must fail.
