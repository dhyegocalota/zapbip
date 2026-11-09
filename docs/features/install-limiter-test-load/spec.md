# Install limiter test load

**Status:** Building
**Tier:** 🟢 small
**Owner approval:** approved 2026-11-08 (lead order after a flake in a verify run)
**ADRs:** none
**Not changing:** product code under `apps/*/src` and `libs/*/src`; the limits in `wrangler.jsonc`

## Problem

`apps/api/test/integration/install-page-attack.test.ts` "IS-S1 limits the real binding per client address and answers Retry-After" failed once under load with `expected 0 to be greater than 0`: it sends 33 sequential requests and expects a 429, and none came.

Cause: the emulated `INSTALL_PAGE_LIMITER` (Miniflare's ratelimit Durable Object) keeps one counter per `(key, period)` with `epoch = floor(Date.now() / (period * 1000))`: a fixed window aligned to the wall clock. When the minute boundary falls inside the loop the counter resets, and 33 requests split into two windows never exceed 30. The chance is the loop duration divided by 60 s, so a slow machine flakes more, and CI will too.

## Goals

- The test starts in a fresh window: if less than a margin of the current 60 s window remains, it waits for the next one. Then it sends the requests as one concurrent burst. It stays a test of the real binding.
- A red variant reproduces the flake deterministically: it waits until 20 ms before a boundary, then runs the old sequential loop.
- Every other limiter test on `main` is checked for the same shape.

## Non-goals

- Faking time inside the Durable Object: the test worker cannot control the emulator's clock.

## Audit

On `main` only IS-S1 asserts a trip of the real binding. The loops in `owner-inbound.test.ts`, `sender-guard.test.ts` and `install-page.test.ts` use `createFakeRateLimiter`, a counter with no clock. `mcp-outbound.test.ts` counts in the account inbox, not in the binding. The IS-S5 burst in the same file asserts no status. On `feat/start-link`, SL-W16 and SL-W17 are to be checked against the same helper when they reach `main`.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How is the test made independent of speed? | wait for a fresh window and burst · fake the clock | recommended: wait for a fresh window and burst; the emulator's clock is not reachable (lead order) | 2026-11-08 |

## Test strategy summary

The straddling variant fails before the fix and the fixed test passes whatever the position inside the window.
