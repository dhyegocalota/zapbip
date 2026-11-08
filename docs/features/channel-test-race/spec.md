# Channel test race

**Status:** Building
**Tier:** 🟢 small
**Owner approval:** approved 2026-11-08 (lead order after CI run 42530660238 on PR #26)
**ADRs:** none
**Not changing:** product code under `apps/*/src` and `libs/*/src`; what the connector tests assert

## Problem

CI run 42530660238 failed in lifecycle shard 1, inside the connector-scaffold proof: `apps/connector/test/integration/channel.test.ts` "relays an owner message as a channel notification from the verified owner and acknowledges it after" got `AssertionError: expected [] to deeply equal [ { …(2) } ]`.

The test waits until the fake server has received the `done` frame, then reads the notifications the MCP client collected. The `done` frame travels over the socket and the notification over the child's standard output pipe, so on a loaded machine the test can read first. It is the race that `listen.test.ts` had (fixed in the `lifecycle-ci-install` feature).

## Goals

- The channel tests wait on the notification (and the connected log line on the error stream) before they read them.
- Every connector test that reads child output or a channel stream after a frame wait is audited. The audit found `channel.test.ts` only: `listen.test.ts` was fixed already; `cli.test.ts`, `connect.e2e.test.ts` and `connect.test.ts` wait on events, on exit or on files the child wrote before it answered.

- The three leak tests (`channel`, `cli`, `listen`) assert a positive anchor on the stream they scan before they assert that the secret and the text are absent, so an empty stream cannot pass them.

## Non-goals

- Changing what the tests assert.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| How is the race reproduced? | CPU saturation · a late-read variant | recommended: a late-read variant, deterministic and with the exact CI message (lead order) | 2026-11-08 |

## Test strategy summary

A late-read variant (the channel stream is read 300 ms late) fails with the CI message before the fix and passes after. CI on the PR runs the lifecycle job.
