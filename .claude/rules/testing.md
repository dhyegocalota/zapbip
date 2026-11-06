---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.test.sh"
  - "**/*.spec.ts"
  - "**/vitest.config.*"
  - "**/playwright.config.*"
---

# Testing facts

## What a useful test is

- It asserts behaviour a user or a caller can observe: a response, a stored row, a message sent, an exit code. It never asserts which private function ran or how often.
- It was red first, for the right reason: the failing assertion is the one the test is named after, not a missing import or a typo. The red commit lands before the fix ([HARNESS → Build](../HARNESS.md#4-build)).
- It has one reason to fail. Two behaviours are two tests; a name that needs "and" is two names.
- It never sleeps. Time is a fake clock the test advances; waiting is a condition the test awaits.
- It never mocks the unit under test. Fake the boundary (the WhatsApp Cloud API, the clock, the network), never the code being proved.
- It builds its own data and leaves nothing behind, so it passes alone, in any order and in parallel.
- A test that is green when it lands is a pin and says so in its commit.

## Vitest and Workers

- Unit and integration tests use Vitest; Worker code that needs Durable Object, D1 or R2 bindings runs under `@cloudflare/vitest-pool-workers`, so it executes in the same runtime as production.
- Each test gets isolated storage; a test that depends on another test's writes is broken, not slow.
- A fake clock advances Worker timers and Durable Object alarms explicitly; real time never moves a test ([the learning](../../docs/learnings/2026-10-17-should-advance-time-lets-real-lag-move-the-fake-clock.md)).
- Shell tests (`*.test.sh`) print `FAIL <name>` per broken check and exit non-zero; they run under `pnpm test:unit`.
