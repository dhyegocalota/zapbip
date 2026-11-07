# A test that buckets by UTC day passes all day and fails with "expected one meter row, found 2" near 00:00 UTC

- Date: 2026-11-07
- Inspired by: `usage-in-object.test.ts` "writes nothing for a second call inside the hour" failing in `pnpm verify all` at 23:02 UTC
- Revisited: 2026-11-07 — still true

## Signal
A test that advances the fake clock by an hour or more reads two meter or daily rows instead of one. It passes when rerun after midnight UTC and on every other machine at every other hour.

## Cause
The clock the test advances starts from `Date.now()`. A meter keyed by UTC day (`usage_meter`, `activity_meter`, `activity_daily`) splits the same activity over two days when the advance crosses midnight, so the number of rows and their counts depend on the hour the suite runs.

## Do
Start the clock at a named instant with `pinClockAt` from `apps/api/test/support/pinned-clock.ts`. The instant is mid-day UTC (`MIDDAY_START`) and in the future, because a Durable Object alarm set in the past fires at once and the test finds none armed. A test that is about the day boundary starts at `SHORTLY_BEFORE_MIDNIGHT_START` on purpose and asserts the split.

## Anchor
`apps/api/test/support/pinned-clock.ts`, `apps/api/test/integration/usage-in-object.test.ts` (red 76b3fa54), `apps/api/test/integration/activity-flush.test.ts`
