# Hermes plugin flake

**Status:** Building
**Tier:** 🟢 small
**Owner approval:** approved 2026-11-07 (owner delegated)
**ADRs:** none
**Not changing:** the plugin code under `apps/hermes-plugin/zapbip_platform`

## Problem

The Hermes plugin pytest step failed once in a full `pnpm verify all` on a busy machine and passed alone and on the next run. Two tests asserted on wall-clock windows: `test_any_frame_is_proof_of_life` reconnected after a 200 ms stall, and `test_stop_during_backoff_returns_promptly` required a stop within 100 ms. The flake did not reproduce in 28 runs, 18 of them under load.

Separately, `typecheck` ran strict mypy on `zapbip_platform` only, so three errors in `tests/support` were never reported.

## Goals

- Heartbeat tests that need a stall of seconds, not milliseconds, to fail.
- `typecheck` covers `tests/`, with the three errors fixed.

## Non-goals

- Injecting a clock into the plugin.

## Design

### Data flow

Test-only change. Proof of life: four pings inside a 2 s timeout, each reply being a non-pong frame; without proof of life the heartbeat waits out the timeout after the first ping and the fourth ping lands after the 5 s `until` bound. Stop during backoff: awaiting the task with the 2 s exit timeout, against a 30 s backoff.

### Failure handling

Each guard still fails when the behaviour breaks (mutation checks in the test plan).

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Inject a clock or widen the margins | clock, margins | margins, the timers guard a hang (owner delegated) | 2026-11-07 |

## Test strategy summary

Unit: the two tests above plus `pnpm typecheck` over `tests/`. Two mutation checks prove the guards still bite.
