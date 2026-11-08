# Backoffice metrics

**Status:** Building
**Tier:** 🟡
**Owner approval:** owner delegated 2026-11-06; split from [`backoffice`](../backoffice/spec.md) as its PR B on 2026-11-08
**ADRs:** [0031](../../adr/0031-the-backoffice-is-a-separate-host-signed-in-with-a-key-and-totp-enrolled-from-the-owners-terminal.md)
**Not changing:** the MCP contract and its tools, the connector protocol, the wake ladder, the 24-hour window rules, the sign-in and numbers pages of the backoffice, and the D1 tables of PR A. No agent, MCP tool or connector frame gains any read or write to the metrics.

## Problem

The operator has a signed-in backoffice and no view of how the product is used: accounts, agents, messages, template sends, send failures, wake success and the Durable Object budget. Each figure needs one documented source and must not add a D1 write per message.

## Goals

- A read-only `GET /metrics` page in the backoffice, filtered by number and by period.
- Activity counted synchronously in each account's Durable Object and flushed hourly to D1.
- The browser walk `metrics.spec.ts` at 1280 and 375.

## Non-goals

- The Analytics Engine `WAKE_METRICS` panel (phase 2).
- Any write path from the metrics page.

## Design

### Metrics (read-only)

**New counters.**

- Durable Object migration `v8.sql` adds `activity_meter(day, metric, count, flushed_count, recorded_at, last_flushed_at)`. It is written synchronously in the account's Durable Object, in the same place the event happens.
- `createActivityProvider` flushes it hourly to D1 `activity_daily(day, account_id, number_id, metric, count, PRIMARY KEY (day, account_id, metric))`. It is a `DueTimeProvider`, the same pattern as v7's `usage_meter` → `usage_daily`.
- No metric adds a D1 write per message.
- `activity_daily.number_id` is the account's current number at the flush: when an account's number changes, the rows of that day are re-attributed to the new number on the next flush.
- Recording never fails a send or a wake: a recording error is caught and logged by event name only, and only a delivery failure of the channel counts as `sends_failed`.

`ActivityMetric` enum (`apps/api/src/contract/activity-metric.ts`): `messages_in`, `messages_out`, `templates_sent_notice`, `templates_sent_question`, `sends_failed`, `wakes_woken`, `wakes_unreached`.

| Metric on the page | Definition | Source | Freshness |
|---|---|---|---|
| Accounts by state | rows of `accounts` per `state` | D1 `accounts` | live |
| New accounts per day | `accounts.created_at` by UTC day, last 30 days | D1 `accounts` | live |
| Accounts per number | `accounts` grouped by `number_id`, joined to `label` | D1 `accounts`, `whatsapp_numbers` | live |
| Agents active | `connections` with `revoked_at IS NULL` | D1 `connections` | live |
| Agents connected | active and `first_call_at IS NOT NULL` | D1 `connections` | live |
| Agents by client | active grouped by `client_name`; `NULL` is shown as the copy "Not reported" | D1 `connections` | live |
| Agents created and revoked per day | `created_at`, `revoked_at` by UTC day, 30 days | D1 `connections` | live |
| Messages in | owner messages the inbox accepted (not duplicates, not dropped) | `activity_daily.messages_in` | up to 1 h |
| Messages out | session sends the Graph API accepted | `activity_daily.messages_out` | up to 1 h |
| Template sends | out-of-window notices sent, by kind | `templates_sent_notice`, `templates_sent_question` | up to 1 h |
| Send failures | sends that ended `failed` at send time | `sends_failed` | up to 1 h |
| Wake success | `woken / (woken + unreached)` per day, by rung outcome | `wakes_woken`, `wakes_unreached` | up to 1 h |
| Durable Object budget | `SUM(gigabyte_seconds)` per day over the selected period from v7, one bar per day against `DURABLE_OBJECT_DAILY_GIGABYTE_SECONDS` (13 000) with the `DAILY_BUDGET_WARNING_RATIO` (0.8) line; `isBudgetWarning` decides today's status. Account-wide: it ignores the number filter and the page says so | D1 `usage_daily` (deploy-readiness) | up to 1 h |
| Blocked phones | rows of `blocked_phones` | D1 | live |
| Restricted numbers | `channel_restrictions` within `RESTRICTION_TTL_MS`, per number | D1 | live |
| Wake attempt latency and status class | phase 2 | Analytics Engine `WAKE_METRICS` through the SQL API, which needs a read-only analytics token | none in phase 1 |

**Page layout.**

- Figures are filtered by number (all, or one) and by period (7, 30 days).
- Charts are server-rendered inline SVG bars with no script, styled by classes from `backoffice.css`, because `style-src 'self'` forbids inline styles.
- All queries for a page run in one `D1Database.batch`.
- The metrics pages are read-only: only `GET` is routed for them, and every statement in the batch is a `SELECT`.
- Today's row carries the copy "updates hourly".

### Filters and refused values

- A missing `period` is the 30-day default, the canonical URL. A `period` that is not `7` or `30` (including an empty one) answers `303` to `/metrics?notice=MetricsPeriodInvalid`, which shows "Período inválido; mostrando 30 dias" / "Invalid period; showing 30 days".
- A `number` that is absent or empty is every number. A `number` that is not a registered number id answers `303` to `/metrics?notice=MetricsNumberNotFound`, which shows "Número não encontrado" / "Number not found". Both notices are in the existing notice allow-list.
- Wake counters count a wake attempt: a `notify` that the inbox made for an agent. `wakes_unreached` is `notify` answering `unreached`. An owner message that is not placed for a known agent, or that arrives while a waiter is live or the batch is not new, makes no attempt and counts nothing.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| D1 migration number | 0006 or 0007 | `0007_activity.sql` (0006 is the flash migration) | 2026-11-06 |
| Durable Object migration | v8 | v8 | 2026-11-06 |
| Write access from the page | none or some | read-only: only GET, every statement a SELECT | 2026-11-06 |
| Charts | script or SVG | inline SVG sized by attributes, no script, strict CSP | 2026-11-06 |
| Invalid period | silent 30 days or refuse | `303` to the canonical URL with a notice | 2026-11-06 |
| Unknown number | zeros or refuse | `303` to the unfiltered page with a notice | 2026-11-06 |

## Test strategy summary

Unit: filter parsing, the wake decorator. Integration: the activity meter in the object, the flush, the metrics page and its refused filters. E2E: `metrics.spec.ts` at 1280 and 375. Details in `test-plan.md`.
