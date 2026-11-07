# Tester briefing: Backoffice metrics

The G4 briefing of the shipped [`backoffice`](../backoffice/tester-briefing.md) feature describes the activity meter, the flush and the page. This file adds step 33a.

## What changed

- `metrics-filter.ts` returns `{ filter }` or `{ notice }`; `isKnownMetricsNumber` checks the id against the registered numbers; `metrics-routes.tsx` redirects with `303` and a notice.
- Notices `MetricsPeriodInvalid` and `MetricsNumberNotFound` with copy keys `NoticeMetricsPeriodInvalid` and `NoticeMetricsNumberNotFound`.

## Hypotheses for the tester

- A missing `period` is 30 days with `200`; `abc`, `90` and an empty `period` are `303` to the canonical URL with the notice.
- A `number` that is not registered is `303` to the unfiltered page with the notice; an empty `number` is every number.
- `wakes_unreached` counts only `notify` attempts. A mention of an agent that is not placed makes none, so "No wakes" is correct there.

## Gaps

- None known for step 33a: the integration cases and the re-arm mutation were run.

## G4 metrics (developer-4, moved from backoffice)

### What changed and where

- Durable Object `v8.sql` (`activity_meter`), `account-inbox/activity-ledger.ts`, `activity-provider.ts` (a `DueTimeProvider` beside the v7 usage one, hourly, prune after 7 days), `activity-recording.ts` (decorates the `MessageSender` and `AgentWaker` that `dependencies` hands to the use cases, so a test that swaps `sender.session` is still counted), and `receiveOwnerMessage`, `receiveChannelMessage` and `receiveAccountMessage` count an accepted, non-duplicate, placed message.
- `migrations/0007_activity.sql` (`activity_daily`), `adapters/d1/d1-activity-repository.ts` (one `batch` per flush, `number_id` read from `accounts` in the same statement), `operations/activity-repository.ts`, `contract/activity-metric.ts`.
- `backoffice/metrics/**`: filter, one-batch queries, series, page, SVG `BarChart` with a native `<details>` table, `BudgetBar`, `FigureNumber`, `SummaryTable`, route. Every numeric cell carries `data-cell`.
- `PERCENT_MULTIPLIER` in `libs/types/src/constants.ts`; four `MetricsAccountState*` copy keys; metrics classes in `backoffice.css`.
- `e2e/backoffice/metrics.spec.ts` with `support/metrics-seed.ts`, `support/layout.ts`; `operator-database.ts` also clears accounts, connections and activity before the registry.

### How to run

From `apps/api`: `pnpm test:integration -- activity-in-object activity-flush backoffice-metrics scheduled-wake-alarm`, `pnpm test:walk -- metrics.spec.ts`.

### Red then green

| Step | Red | Failure text printed | Green |
|---|---|---|---|
| 31 | bfa914e6 | `expected +0 to be 1` (eight cases) | 80cc59be |
| 32 | e4b1d8ec | `expected [] to deeply equal [ { day: '2026-11-07', … } ]`, `expected 0 to be greater than 0`, `expected [ '2026-10-30', '2026-11-07' ] to not include '2026-10-30'`; pin: no second write | 9b207d56 |
| 33 | 6290ca4f | `expected 404 to be 200` (nine cases); pin: non-GET methods answer 404 | 24e3b39f |
| 39 | pin 3857ef49 | none: the spec lands after the page | |

### Hypotheses for the tester

- A seeded world shows exactly the figures in `test-plan.md` for all numbers and for one number; the seven-day filter drops older activity.
- 81 % of the daily budget shows the warning copy, hatched fill and tick; 79 % shows "Within budget".
- An empty database shows zeros and "No data yet", never `NaN` or `0%` for wakes.
- The page has no script and no inline style; each chart has a table behind "Show values".

### Gaps and deviations

- `wakes_unreached` counts a `notify` that returned `Unreached`, including the default inbox rung of an agent whose wake setting is `none`. A mention that is not placed for a known agent, or that meets a live waiter or a batch that is not new, makes no attempt and counts nothing (spec: wake counters count attempts).
- Template sends use the same chart as messages, not a table alone.
- The budget bar reads today's `usage_daily` total and is not filtered by number (usage has no number).
- A missing `period` is 30 days; an invalid `period` or an unknown `number` is a `303` with a notice (step 33a).
