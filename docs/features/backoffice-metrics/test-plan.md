# Test plan: Backoffice metrics

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## Unit and integration

Metrics (PR B: `activity-in-object.test.ts`, `activity-flush.test.ts`, `backoffice-metrics.test.ts`):
- [ ] Each `ActivityMetric` increments by exactly one on its event; a duplicate inbound adds zero — open, PR B (G4)
- [ ] Flush after 1 h → the `activity_daily` row equals the meter, with `number_id` equal to the account's number; a second flush leaves the same count — open, PR B (G4)
- [ ] Seeded data → every figure equals its definition (accounts 2/3/1/1 by state, agents active 4, connected 3, revoked 2, budget 79 % without the warning class, 81 % with it) — open, PR B (G4)
- [ ] An empty database → the zero state on every tile, no error — open, PR B (G4)
- [ ] Each metrics page makes exactly one `batch` call — open, PR B (G4)
- [ ] Every statement prepared by a metrics page begins with `SELECT`; `POST`, `PUT`, `PATCH` and `DELETE` on `/metrics` → `404` — open, PR B (G4)
- [ ] `metrics.spec.ts::shows seeded metrics and filters by number` (PR B) — expected: the figures match the seed; the filter narrows to one number — open, PR B (G4)
- [ ] `backoffice-metrics-filter.test.ts` — `period` `abc`, `90`, empty → notice `MetricsPeriodInvalid`; `period` missing → 30 days; `number` empty → every number; `number` `nope` → not known — evidence: unit, 40 passed at 14f8dd7f
- [ ] `backoffice-metrics.test.ts` — `GET /metrics?period=abc` → `303` to `/metrics?notice=MetricsPeriodInvalid`; `GET /metrics?number=nope` → `303` to `/metrics?notice=MetricsNumberNotFound`; the notice copy shows on the followed page — open, not run: staging deploy freeze
- [ ] `activity-recording.test.ts` — a `notify` answering `unreached` records `wakes_unreached`; `hasFailedWake` records nothing — evidence: unit, 3 passed
- [ ] `activity-flush.test.ts` — after the flush alarm the next pending deadline is armed at its real time; skipping the re-arm after the flush turns it red — open, mutation not run

## E2E (Playwright specs)

- [ ] `metrics.spec.ts` — the figures match the seed, the filter narrows to one number, the charts carry no script, no horizontal scroll at 1280 and 375 — evidence: walk 40 passed at dfdfe761

## Prove it for real — Playwright MCP

- [ ] Walk `/metrics` at 1280 and 375 with a seeded world, an empty database and a refused `period`; expected: the copy of `design.md` §4.8, the notice on a refused filter, console and network clean

## Edge cases found during execution

Empty on purpose.

## Adversarial review

- [ ] Reviewer verdict recorded.
