# Test plan: Install limiter test load

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `apps/api/test/integration/install-page-attack.test.ts::IS-S1 ... when the window rolls during the loop` — input: wait until 20 ms before a 60 s window boundary, then 33 sequential requests from one address; expected before the fix: `expected 0 to be greater than 0` (no 429).

## Unit

- [ ] `apps/api/test/unit/rate-limit-window.test.ts` — `msUntilFreshWindow` returns 0 early in a window and when exactly the margin remains, the remaining time when less than the margin remains, and a whole window when the margin exceeds it: 4 of 4.

- [ ] `apps/api/test/integration/install-page-attack.test.ts::IS-S1 limits the real binding per client address and answers Retry-After` — expected: green five runs in a row, each started at a different second of the minute, including one that starts within 5 s of a boundary (it waits for the next window).
- [ ] Audit — expected: no other test of `apps/api/test` asserts a trip of a real ratelimit binding after a loop (`grep -rn "429" apps/api/test`).

## Coverage honesty

- SL-W16 and SL-W17 of `feat/start-link` are not on `main` yet; they are listed for the same check.
