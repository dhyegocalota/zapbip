# Plan: Backoffice metrics

**Spec:** spec.md
**Tier:** 🟡
**Seam:** the account Durable Object (`activity_meter`, v8), the D1 directory (`activity_daily`, `0007`) and the backoffice app (`GET /metrics`).
**Assumptions (decided, owner can override):**
- D1 migration `0007`, Durable Object migration v8, read-only page, SVG charts, redirects for refused filters: owner delegated 2026-11-06.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G4 metrics (PR B) | `apps/api/src/account-inbox/migrations/v8.sql` (new), `apps/api/src/account-inbox/migrations/index.ts`, `apps/api/src/account-inbox/activity-ledger.ts` (new), `apps/api/src/account-inbox/activity-provider.ts` (new), `apps/api/src/contract/activity-metric.ts` (new), `apps/api/migrations/0007_activity.sql` (new; 0006 is `0006_backoffice_flash.sql`, so G4's activity migration is 0007), `apps/api/src/adapters/d1/d1-activity-repository.ts` (new), `apps/api/src/backoffice/metrics/**` (new), `apps/api/test/integration/activity-*.test.ts`, `apps/api/test/integration/backoffice-metrics.test.ts`; the `recordActivity` calls in `account-inbox.ts` after G3's commit to that file lands | `developer-4` |

## Sequencing

One developer. Branch `feat/backoffice-metrics`, merged from `feat/backoffice` and `main` by merge, never rebase.

## Steps

### G4 metrics

- [x] **Step 31:** red: `activity-in-object.test.ts`:
  - an accepted owner message → `messages_in` +1;
  - a duplicate → +0;
  - a session send → `messages_out` +1;
  - a template notice → `templates_sent_notice` +1;
  - a failed send → `sends_failed` +1;
  - a woken wake → `wakes_woken` +1;
  - unreached → `wakes_unreached` +1.

  Then `v8.sql`, `activity-ledger.ts` and the `recordActivity` calls. — evidence: red bfa914e6 (`expected +0 to be 1`; `v8.sql` and the `ActivityMetric` enum land with the red as scaffolding) → green 80cc59be. The calls live in `activity-recording.ts`, which decorates the sender and the waker at their port, plus three `receive*` methods in `account-inbox.ts`.
- [x] **Step 32:** red: `activity-flush.test.ts`. After one hour on the fake clock the D1 `activity_daily` row equals the meter, with `number_id` equal to the account's number. A second flush is idempotent. Pruning after 7 days. Then `activity-provider.ts`, ~~`0006_activity.sql`~~ `0007_activity.sql` (0006 is the flash migration) and `d1-activity-repository.ts`. — evidence: red e4b1d8ec (`expected [] to deeply equal [ … ]`; the `0007` table lands with the red; 'does not write again when nothing was recorded after the flush' is a pin) → green 9b207d56. `scheduled-wake-alarm.test.ts` now flushes both meters before it re-arms, and `account-inbox.test.ts` clears the activity meter beside the usage meter.
- [x] **Step 33:** red: `backoffice-metrics.test.ts`:
  - seeded accounts in four states, connections active, revoked and connected, `usage_daily` at 79 % and 81 %, and activity across two numbers → each figure on the page equals the spec definition;
  - the number filter;
  - the period filter;
  - an empty database renders the zero state;
  - one `batch` call per page (a spy on the binding);
  - read-only: every statement prepared by a metrics page begins with `SELECT`, and `POST`, `PUT`, `PATCH` and `DELETE` on `/metrics` → `404`.

  Then `backoffice/metrics/**`. — evidence: red 6290ca4f (`expected 404 to be 200`; the four non-GET cases are a pin) → green 24e3b39f. Four copy keys for the account states were added (`MetricsAccountState*`) and `PERCENT_MULTIPLIER` joined `libs/types`.

- [x] **Step 33a:** tester findings of PR B (18 PASS, 2 FAIL, 1 observation). Decisions owner delegated 2026-11-06.
  - [x] An invalid `period` and an unknown `number` redirect with a notice instead of rendering a silent default. — evidence: red 63428ec9 (`expected { numberId: null, period: '30' } to deeply equal { notice: 'MetricsPeriodInvalid' }`; `isKnownMetricsNumber is not implemented`) → green 14f8dd7f (unit, 40 passed with the copy and design-rule suites)
  - [x] The integration cases for both redirects in `backoffice-metrics.test.ts` pass. — evidence: 19 passed (written with the fix in 14f8dd7f, so no separate red run; the unit red is 63428ec9)
  - [x] `wakes_unreached` counts a `notify` that answered `unreached`; a mention that makes no wake attempt counts nothing, and the briefing now says so. — evidence: pin, `activity-recording.test.ts` (3 passed)
  - [x] After the activity flush alarm fires, the next pending deadline is still armed, and the assertion fails when the re-arm after the flush is skipped. — evidence: the first run failed with `expected 1893499205022 to be 1893499800006` because the usage meter was already due again; the test now marks usage flushed first (7 passed). Mutation: removing the `armAlarm()` at the end of `alarm()` fails it with `expected null to be 1893499800007`; restored

- [x] **Step 33b:** PR B review (WITH RESERVATIONS). Decisions owner delegated 2026-11-06.
  - [x] The budget is one bar per day of the period against the limit and the 80 % line, from `usage_daily` in the same single batch, account-wide with a note. — evidence: red b3f74f0a (`cell budget-used:2026-11-06 is missing`) → green 855aad37 (`backoffice-metrics` 32 passed with `activity-in-object`); walk case in `metrics.spec.ts`
  - [x] `docs/features/README.md` no longer says the shipped `backoffice` delivers metrics; the metrics design moved to `backoffice-metrics/design.md`. — evidence: this commit
  - [x] Recording never fails a send or a wake, and only a channel delivery failure counts as `sends_failed`. — evidence: red b3f74f0a (`expected ok, received delivery_failed`; a plain error counted) → green 855aad37 (unit 14 and the dropped-table integration case)
  - [x] The spec says `activity_daily.number_id` follows the account's current number. — evidence: this commit
  - [x] One percent formatter, `format-percent.ts`, with the `%` in a copy key. — evidence: red b3f74f0a (`formatPercent is not implemented`) → green 855aad37
  - [x] `activity-flush.test.ts` restores mocks after each test. — evidence: this commit
  - [x] The midnight case starts half an hour before midnight, so a loaded machine cannot cross by accident. — evidence: this commit

### G6 browser specs

- [x] **Step 39m:** `e2e/backoffice/metrics.spec.ts` with `support/metrics-seed.ts` and `support/layout.ts`, at 1280 and 375. — evidence: pin 3857ef49 (lands after the page); `pnpm --filter @zapbip/api test:walk` 40 passed at dfdfe761

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 31 | A count is written for a duplicate | `activity-in-object` red | revert the commit; the meter is derived data |
| 32 | The flush drops another deadline | `activity-flush` and `scheduled-wake-alarm` red | revert; no data lost, the meter keeps its rows |
| 33 | The page writes | a non-SELECT in the batch spy | revert; `0007` stays, it is additive |
