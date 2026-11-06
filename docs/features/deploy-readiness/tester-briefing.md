# Tester briefing: Deploy readiness

Written by the developer sub-agent when its steps are done. The developer does not run `test-plan.md` and does not declare the feature works.

## Step 0 (contract) — done

Commits: `docs(deploy-readiness): spec, plan, test plan and ADRs` (2f13106), `docs(deploy-readiness): refresh the plan against slice 1's code` (6c71ab2), `chore(api): add the deploy and smoke root scripts` (c7048b1), `chore(env): add the environment example and its gate rows` (d4e6d60), `feat(api): land the deploy-readiness contract` (2dc88a2).

Step R corrections are listed in `plan.md` under "Step R results (2026-11-06)". Summary: production is the top-level block; `REPLACE_WITH_` placeholders; `tsx` already present; health lives in `app.ts`; `MEDIA_LINK_SIGNING_KEY` already used, so no rename.

## What changed

- `apps/api/src/operations/deploy-environment.ts` — `DeployEnvironment` enum and `parseDeployEnvironment` stub.
- `apps/api/src/operations/worker-secret.ts` — `WorkerSecret` enum (seven names).
- `apps/api/src/operations/constants.ts` — cron strings, placeholder prefix `REPLACE_WITH_`, smoke polling, budget constants.
- `apps/api/src/operations/scheduled-job.ts`, `scheduled.ts` (stub `runScheduled`), `usage-repository.ts` (interface).
- `apps/api/src/account-inbox/usage-meter.ts` — four stubs.
- `apps/api/src/contract/env.ts` — `ENVIRONMENT: string` added to `Bindings`.
- `apps/api/src/index.ts`, `index.dev.ts` — `scheduled` export calling `runScheduled` with `createPlatformClock().now()`.
- `package.json` — `deploy:*`, `migrate:*`, `smoke:*` scripts (the scripts they name do not exist yet; lanes B and C create them).
- `.gitignore` — `.dev.vars`.
- `.env.example` — seven `WorkerSecret` names and three smoke inputs, all `REPLACE_WITH_…`.
- `scripts/verify-gates.tsv` — rows for `apps/api/wrangler.jsonc` and `.env.example`.
- `tools/repository-shape/src/delivery-docs.test.ts` — `.env.example` in `ROOT_ENTRIES`.
- `docs/adr/0026…`, `docs/adr/0027…`, both indexes, `docs/features/deploy-readiness/` (spec status `Building`).

## How to run

```bash
cd <worktree> && pnpm install --frozen-lockfile && pnpm typecheck && pnpm verify
```

Result on this branch: typecheck green; `pnpm verify` green (9 gates, docs ok, repository-shape 61/61, core 270/270, api unit 37/37).

## Red today, green after

No Step 0 test is red: the contract is stubs that throw, and no test calls them yet. The first red tests are lane C's `wrangler-config` and lane A's `usage-meter`.

| Test | Red before the change because | Green after because |
|------|--------------------------------|---------------------|
| (none in Step 0) | | |

## Hypotheses to attack

1. Hypothesis: the scheduled export does not change behaviour for slice 1. Break it by: calling `fetch` on the production entry and checking `/health` and the MCP route still answer.
2. Hypothesis: `.env.example` is tracked and no real `.env` is. Break it by: `git ls-files | grep '^\.env'` and checking `.gitignore` excludes `.env` but not `.env.example`.
3. Hypothesis: the root scripts reference files that do not exist yet. This is expected for Step 0; break it only after lanes B and C land.

## Known gaps

- The plan's Step 0 "meter wrapper as a pass-through" on `AccountInbox` is not in Step 0. Nothing needs it until lane A's test exists; it lands with A4.
- `scripts/deploy.ts`, `smoke.ts`, `runbooks/` and the docs preflight do not exist yet (lanes B and D).
- The spec's health check text (`status: "ok"`) conflicts with the decisions file (`ok: true`); the decisions file is followed.

## Lane A (usage and jobs) — done

Commits (red marked): `6930ad6` red usage-meter arithmetic, `358e082` arithmetic; `fff8c08` migration `0003_usage.sql`; `6d10114` red, `0cf7989` D1 repository; `1b5d79d` red, `c06ab52` meter in the object (v7, ledger, provider, RPC wrapper); `c22e6ef` pin usage security; `244cb3b` red, `9b72906` media retention; `cfcda2b` red, `043b2f3` budget check and dispatch; `bb99d7c` integration of the two crons.

### What changed

- `apps/api/src/account-inbox/usage-meter.ts` — arithmetic; `usageFlushDueAt` is `(lastFlushedAt or now) + HOUR_MS`.
- `apps/api/src/account-inbox/migrations/v7.sql` and `index.ts` — table `usage_meter (day, gigabyte_seconds, flushed_gigabyte_seconds, recorded_at, last_flushed_at)`; registry is `[1, 7]`.
- `apps/api/src/account-inbox/usage-ledger.ts` — SQLite record, list-unflushed and mark-flushed.
- `apps/api/src/account-inbox/usage-provider.ts` — the due-time provider: flushes absolute day totals to D1 once due, marks them flushed only after `reportDay` resolved.
- `apps/api/src/account-inbox/account-inbox.ts` — `outcome()` (the funnel of every RPC method) times the call and records it before re-arming the alarm; provider pushed in the constructor.
- `apps/api/src/adapters/d1/d1-usage-repository.ts`, `apps/api/migrations/0003_usage.sql`.
- `apps/api/src/adapters/r2/r2-media-listing.ts`, `apps/api/src/operations/{media-retention,budget-check,scheduled}.ts`.
- `apps/api/src/contract/log.ts` — additive: `LogEvent.BudgetWarning = 'budget.warning'`, fields `day`, `gigabyteSeconds` (no lane owned this file).
- `apps/api/test/integration/account-inbox.test.ts` (slice 1) — WI-118 expects `[1, 7]` and `usage_meter`; the alarm-deadline test deletes the `usage_meter` row first, because the usage flush (one hour) is now earlier than the 24 hour expiry.

### How to run

```bash
cd apps/api
pnpm exec vitest run --config vitest.unit.config.mts test/unit/usage-meter.test.ts test/unit/media-retention.test.ts test/unit/scheduled.test.ts
pnpm exec vitest run --config vitest.integration.config.mts test/integration/usage-repository.test.ts test/integration/usage-in-object.test.ts test/integration/usage-security.test.ts test/integration/scheduled.test.ts
```

### Red today, green after

| Test | Red text | Green because |
|---|---|---|
| `usage-meter.test.ts` (11) | `gigabyteSecondsForDuration is not implemented` | arithmetic bodies |
| `usage-repository.test.ts` (5) | `D1UsageRepository.readDayTotal is not implemented` / `.reportDay is not implemented` | upsert and sum |
| `usage-in-object.test.ts` (4) | `no such table: usage_meter: SQLITE_ERROR`; flush cases `expected false to be true` (no alarm armed) | v7, ledger, provider, wrapper |
| `media-retention.test.ts` (4) | `runMediaRetention is not implemented` | listing and batched delete |
| `scheduled.test.ts` unit (7) | `runScheduled is not implemented` | record-keyed dispatch and budget check |
| `usage-security.test.ts` (3), `scheduled.test.ts` integration (4) | pins, green on landing | |

### Hypotheses to attack

1. A resolved RPC call adds its wall-clock duration to `usage_meter` and never writes to D1 from the request path. Break it by: counting `usage_daily` upserts across 1,000 calls inside one hour (test-plan U-HOUR); expect none before the alarm.
2. The flush writes the absolute day total, so a repeated or retried flush is idempotent. Break it by: running the alarm twice with new calls in between.
3. A failed D1 write keeps the due time, so the next alarm retries and the caller is unaffected. Break it by: dropping `usage_daily`, calling, advancing an hour, then restoring the table and running the alarm.
4. A request with an unknown, revoked or malformed secret never reaches the object. Break it by: a secret that shares a prefix with a real one.
5. Retention deletes only objects with `uploaded < now - MEDIA_RETENTION_MS`, across pages. Break it by: 2,001 objects, and a key deleted between list and delete.
6. The budget check reads one D1 total and never lists accounts. Break it by: spying on `prepare`.

### Known gaps

- Zero-usage decision: a call measuring 0 ms adds 0 gigabyte seconds, creates no flushable usage and no D1 write; only gigabyte seconds are metered, not calls (pin in `usage-in-object.test.ts`).
- A D1 outage retries every 5 seconds (`ALARM_MIN_DELAY_MS`) until it recovers, per the test plan ("the due time is kept"). Not load-tested.
- Pruning runs inside the object at every alarm (flushed rows older than `USAGE_METER_RETENTION_MS`, seven days), not in the daily cron: the test plan requires retention to touch R2 only and no cron fans out over accounts.
- Retention deletes every object in the bucket past the cutoff and does not look at key shape; the bucket holds media only. It collects all listed objects in memory before deleting; a very large bucket is not tested.
- U-HOUR (1,000 calls, counted with D1 triggers), alarm order and zero usage are pins in `usage-in-object.test.ts` (commit after c22e6ef); the prune case was red first.
- Order changed from the plan: A7 landed before A6/A8, and A6 shares its red/green commits with A8 because the budget cases run through `runScheduled`.
