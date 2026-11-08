# Test plan: Backoffice metrics

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## Unit and integration

- [x] Each `ActivityMetric` increments by exactly one on its event; a duplicate inbound adds zero — evidence: `activity-in-object` 8/8 and the live walk (4 inbound, 1 duplicate, `messages_in` 4), tester-metrics.md at dfdfe761; green 80cc59be
- [x] Flush after 1 h → the `activity_daily` row equals the meter, with `number_id` equal to the account's number; a second flush leaves the same count — evidence: `activity-flush`, live D1 `messages_in` 4, `messages_out` 3, `number_id` of the account, tester-metrics.md at dfdfe761; green 9b207d56
- [x] Seeded data → every figure equals its definition (accounts by state, agents active, connected, revoked, budget 79 % without the warning class, 81 % with it) — evidence: `backoffice-metrics` 13/13 and the live page equal to D1, tester-metrics.md at dfdfe761; green 24e3b39f
- [x] An empty database → the zero state on every tile, no error — evidence: `backoffice-metrics` and `metrics.spec.ts` empty state, tester-metrics.md at dfdfe761
- [x] Each metrics page makes exactly one `batch` call — evidence: `backoffice-metrics`, tester-metrics.md at dfdfe761; the budget stays inside it, tester-metrics-delta.md at c2593ffb
- [x] Every statement prepared by a metrics page begins with `SELECT`; `POST`, `PUT`, `PATCH` and `DELETE` on `/metrics` → `404` — evidence: `backoffice-metrics`; mutation SELECT to UPDATE turned 9 cases red, tester-metrics.md at dfdfe761
- [x] `backoffice-metrics-filter.test.ts` — `period` `abc`, `90`, empty → notice `MetricsPeriodInvalid`; `period` missing → 30 days; `number` empty → every number; `number` `nope` → not known — evidence: red 63428ec9 → green 14f8dd7f; browser walk of the refused filters, tester-metrics-delta.md at c2593ffb
- [x] `backoffice-metrics.test.ts` — `GET /metrics?period=abc` → `303` to `/metrics?notice=MetricsPeriodInvalid`; `GET /metrics?number=nope` → `303` to `/metrics?notice=MetricsNumberNotFound`; the notice copy shows on the followed page — evidence: 19 passed; mutation "no redirect" turned 3 cases red (`expected 200 to be 303`), tester-metrics-delta.md at c2593ffb
- [x] `activity-recording.test.ts` — a `notify` answering `unreached` records `wakes_unreached`; `hasFailedWake` records nothing; a recording error never fails a send; only a channel delivery failure counts as `sends_failed` — evidence: red b3f74f0a → green 855aad37; mutations "record rethrows" (5 unit and 1 integration red) and "any throw is `sends_failed`" (2 unit red), tester-metrics-delta.md at c2593ffb
- [x] `activity-flush.test.ts` — after the flush alarm the next pending deadline is armed at its real time; skipping the re-arm after the flush turns it red — evidence: 7 passed; mutation `expected null to be 1893499800007`, c5464c5f; `scheduled-wake-alarm` 11/11, tester-metrics.md at dfdfe761
- [x] `backoffice-metrics.test.ts` — `usage_daily` rows on yesterday (two accounts), today and ten days ago → `budget-used:<day>` cells sum per day; `period=7` drops the ten-day-old day; `number=<id>` keeps the same values and shows the account-wide note; the budget stays inside the one batch of selects — evidence: red b3f74f0a → green 855aad37; seeded sums 4000/9000/10500/11000/13500/2500/10500 equal the cells, tester-metrics-delta.md at c2593ffb
- [x] `activity-in-object.test.ts` — `activity_meter` dropped, then a session send → the send reports success, the channel is called once, the log carries `activity_record_failed` and nothing else — evidence: green 855aad37; red under "record rethrows", tester-metrics-delta.md at c2593ffb
- [x] `backoffice-format-percent.test.ts` — `66.66666` → `66.7%`, `75` → `75.0%`, in both locales — evidence: red b3f74f0a → green 855aad37 (unit 1063 passed, tester-metrics-delta.md at c2593ffb)

## E2E (Playwright specs)

- [x] `metrics.spec.ts` — the figures match the seed, the filter narrows to one number, the charts carry no script, no horizontal scroll at 1280 and 375 — evidence: walk 8/8 at dfdfe761 (tester-metrics.md at dfdfe761), 42/42 at c2593ffb (tester-metrics-delta.md at c2593ffb)
- [x] `metrics.spec.ts::keeps the budget chart labels clear of the bars and of each other with a day over the limit` — a day at 14 000 gigabyte-seconds; expected: no label box intersects a bar or another label and every label sits inside the chart, at 1280 and 375 — evidence: red ce7a82b9 (`expected 4147.84 to be >= 4154.31`) → green 5242599a (metrics.spec 12/12)

## Prove it for real — Playwright MCP

- [x] Walk `/metrics` at 1280 and 375 with a seeded world, an empty database and a refused `period`; expected: the copy of `design.md` §4.8, the notice on a refused filter, console and network clean — evidence: tester-metrics.md at dfdfe761 (period switch, no scroll at 1280 and 375, CSP clean) and tester-metrics-delta.md at c2593ffb (refused filters, budget chart, console errors 0); screenshots `.pr-media/backoffice-metrics/{metrics-1280,metrics-375,budget-over-limit,notice-period}.png`

## Edge cases found during execution

- [x] A day over the limit: the limit label was clipped at the top, "Limite de 80%" overlapped the last bars and the maximum label collided with the limit line — evidence: found by the delta tester (tester-metrics-delta.md at c2593ffb); regression test ce7a82b9, fix 5242599a

## Adversarial review

- [x] Reviewer verdict recorded. — evidence: WITH RESERVATIONS, every finding fixed in step 33b; security verdict CLEAR
