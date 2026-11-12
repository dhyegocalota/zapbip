# Deploy readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make zapbip deployable to `staging` and `production` on the Workers Free plan: a `wrangler.jsonc` whose deployed blocks repeat every binding, a deploy command that refuses unsafe runs, a smoke test, a per-account usage meter inside the Durable Object, an hourly budget check and a daily R2 retention cron, and the owner's runbooks.

**Architecture:** `apps/api/wrangler.jsonc` ~~keeps the top-level development block that `wrangler dev` reads and adds `env.staging` and `env.production`~~ keeps the top-level block as production, as slice 1 shipped it, and adds `env.development` for `wrangler dev` and `env.staging`; each block repeats every binding because wrangler does not inherit them (corrected at Step R). Pure preflight and smoke logic sits in `apps/api/src/operations/` behind named ports (`DeployShell`, `DeployPrompt`, `SmokeFetch`); the entry scripts only wire the real process, terminal and `fetch`. Usage is counted inside each account's Durable Object for resolved connections only and reported to D1 `usage_daily`. The hourly budget check sums that table; the daily retention cron lists R2 only. No cron fans out over accounts.

**Tech Stack:** Node 24, TypeScript, pnpm workspaces, Vitest (`apps/api` 4.1.12, `@cloudflare/vitest-pool-workers` 0.23.0), wrangler 4.158.0, Hono 4.13.16, tsx 4.23.15 (new, runs the scripts), Cloudflare D1, R2, Durable Objects and Rate Limiting.

**Spec:** `docs/features/deploy-readiness/spec.md`, as amended by `SCRATCH/feature-stash/cross-slice-decisions.md`. Where they differ, the decisions file wins. Owner decisions are recorded there under `owner delegated 2026-11-06`. ADRs 0026 and 0027 are copied into the repository by Step S0.5.

~~**Precondition:** `agent-inbox-core`, `whatsapp-cloud-channel`, `accounts-and-keys` and `webhook-wake` are on `main`. Per the build order, this slice runs in parallel with those three and branches from `main` once core is merged; `scheduled-wake`, `local-connector` and `install-skills` may land later and add their own bindings through the parity rule.~~
**Precondition (corrected at Step R):** `agent-inbox-core` is on `origin/feat/agent-inbox-core`, not yet on `main`; this branch is based on it. `whatsapp-cloud-channel`, `accounts-and-keys` and `webhook-wake` are not on it. The parity test covers only the binding keys that exist; later slices extend it through the parity rule.

## Global Constraints

~~- Blocks: the top-level block is development (`main: src/index.dev.ts`, `vars.ENVIRONMENT: development`). `env.staging` and `env.production` use `main: src/index.ts`. Every binding key of the top-level block is repeated in both deployed blocks: `d1_databases`, `r2_buckets`, `durable_objects`, `ratelimits`, `analytics_engine_datasets`, `rules` (only if main declares one), `vars`, `migrations`, `triggers`. Test C1 asserts this parity by key set.~~
- Blocks (corrected at Step R): the top-level block is production (`main: src/index.ts`, https `PUBLIC_ORIGIN`), as slice 1 shipped it and as the decisions file says. `env.development` uses `main: src/index.dev.ts`; `env.staging` uses `main: src/index.ts`. Every binding key is repeated in all three blocks, `rules` included, because `main` declares it.
- Worker names, hosts, D1 and R2 names follow the spec's Environments table. The base URL var is `PUBLIC_ORIGIN` only. Values: development `http://localhost:8787`; staging `https://mcp-staging.zapbip.com`; production `https://mcp.zapbip.com`.
- `vars` in every block: `ENVIRONMENT`, `PUBLIC_ORIGIN`, `WAITLIST_ENABLED` (`false`, `false`, `true` for development, staging, production) and `WHATSAPP_GRAPH_BASE_URL` (development: a placeholder local URL that the E2E harness overrides with `--var`; staging and production: `https://graph.facebook.com`).
~~- `compatibility_date` `2026-11-01`; `compatibility_flags: ["nodejs_compat"]`; `observability.enabled: true`; `workers_dev: false`; `preview_urls: false`.~~
- `compatibility_date` `2026-08-15`, kept from slice 1 (corrected at Step R from `2026-11-01`); `compatibility_flags: ["nodejs_compat"]`; `observability.enabled: true`; `workers_dev: false`; `preview_urls: false`.
- Wrangler Durable Object migrations: `[{ "tag": "v1", "new_sqlite_classes": ["AccountInbox"] }]` in every block. These wrangler tags are separate from the Durable Object SQL schema versions below.
~~- `apps/api/wrangler.jsonc` is plain JSON: no comments, no trailing commas. The preflight reads it with `JSON.parse`.~~
- `apps/api/wrangler.jsonc` is JSONC, formatted by the repository Prettier (trailing commas allowed). Every reader parses it with wrangler's `experimental_readRawConfig`, never `JSON.parse` (corrected at lane C, coordinator 2026-11-06).
- Cron: one `SCHEDULED_CRON = '*/30 * * * *'` per block with a job registry by tick (every tick install-secret clear and deletion sweep; minute 0 budget check; 03:00 UTC media retention), in `apps/api/src/operations/constants.ts`. No cron fans out over accounts. Queue and question expiry are per-object Durable Object alarms from slice 1.
- Time constants come from `libs/types` (`SECOND_MS`, `MINUTE_MS`, `HOUR_MS`, `DAY_MS`, slice 1). No local copy.
- The webhook path is slice 2's exported constant `WHATSAPP_WEBHOOK_PATH` (`/webhooks/whatsapp`). This slice imports it and does not declare its own.
- Secrets: exactly the seven `WorkerSecret` names: `META_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `MEDIA_LINK_SIGNING_KEY`, `UPLOAD_LINK_SIGNING_KEY`, `WAKE_SECRET_KEY`. `MEDIA_LINK_SIGNING_KEY` is the name in the spec and the decisions file; Step R1 confirmed this branch already uses it (`contract/env.ts`, `routes/media.ts`), so no rename is needed. The Worker secret `TURNSTILE_SECRET_KEY` of [waitlist-landing](../waitlist-landing/spec.md) is outside this list: the preflight never refuses for it.
- Migrations: names are read from `main` at Step R0. Reserved numbers: `0001` agent-inbox-core (`0001_core`), `0002` accounts-and-keys, `0003` deploy-readiness (usage), `0004` whatsapp-cloud-channel. A migration is immutable once it has reached a deployed environment; until then a slice may rebuild its own tables.
- Durable Object SQL schema: this slice ships version `v7` (usage). The DO migration runner records the set of applied versions (slice 1).
- R2 keys are `accounts/<accountId>/media/<mediaId>`; the signed media link is `/m/<accountId>/<mediaId>?exp=&sig=`.
~~- Placeholder values and IDs start with `PLACEHOLDER_VALUE_PREFIX` (`replace-with-`). A placeholder counts as missing.~~
- Placeholder values and IDs start with `PLACEHOLDER_VALUE_PREFIX` (`REPLACE_WITH_`, corrected at Step R from `replace-with-`: slice 1's wrangler test pins `REPLACE_WITH_PRODUCTION_D1_DATABASE_ID`). A placeholder counts as missing.
- Scripts run as `node --env-file=.env --import tsx <file>`. Node 24 cannot resolve the extensionless imports this repo uses; `tsx` is the loader.
- Wrangler runs from `apps/api` as `pnpm --filter @zapbip/api exec wrangler …`.
- Identifiers spell units out: `gigabyte`, never `gb`. D1 column `gigabyte_seconds`.
- Repo rules (`AGENTS.md`): no comments except `// NB ADR NNNN:` pointers; flat `if`s; no `else`; no `??` defaults; enums over string literals; named parameters for any function with more than one parameter; constants over literals; array methods over loops, except paging, which recurses.
- Stub bodies in Step 0 are exactly `void input;` followed by `throw new Error('<name> is not implemented');`.
- The red commit of every test-first step contains only the failing test (plus the stub it needs). The green commit contains only the implementation. The failure text of each red run goes in `tester-briefing.md`.
- No `sleep` anywhere. Time in tests comes from injected `now`, `wait` and `fetch` parameters.
- Agents never run `deploy`, `migrate` or `smoke` against a deployed environment, never write env files or `apps/api/.dev.vars`, and never set a secret. The E2E test passes its fake secrets to `wrangler dev` as `--var` flags.
- Commits: Conventional Commits, en-US, `Co-Authored-By` trailer naming the model that wrote the commit. Never `git add -A`, `git add .`, `--no-verify`. Never commit on `main`.
- **Health route (corrected at Step R).** `/health` is declared in `apps/api/src/app.ts` (`app.get(HEALTH_PATH, …)`); there is no `routes/health.ts`. Lane C edits that line and creates no route file.
- **Docs and npm preflight (decisions 2026-11-06).** The deploy preflight also gates the docs deploy: it refuses while `OFFICIAL_WHATSAPP_NUMBER` is the sentinel `OFFICIAL_NUMBER_UNSET`, and it refuses until `npm view zapbip@<version>` resolves, where `<version>` is the exact version the docs and skills pin. Each value has one source; neither exists on this branch yet (`(contract: confirm at build)`). The runbook makes "publish zapbip@<version> to npm" an owner step. The preflight never publishes.
- Shared files are edited additively, never recreated: `apps/api/src/contract/env.ts`, `apps/api/src/app.ts`, `apps/api/src/index.ts` (keeps `export { AccountInbox }`, adds `scheduled`), `apps/api/wrangler.jsonc`.
- **Durable Object alarm arming (cross-slice).** Every write path re-arms the object's alarm to the earliest due time across all registered due-time providers: slice 1 expiry, slice 4 wake jobs, slice 7 stale-poll checks, and this slice's usage flush. This slice registers its provider and never arms the alarm on its own.

## Plan refresh against main (Step R, runs first, before S0)

Nothing in this plan's contract is trusted until the refresh has run. Step R0 is a diff of the plan against the merged files; each difference is corrected in this file before any lane starts.

- [x] **R0 Diff against main.** For each snippet in **Contract** and each path in **File map**, check the file on `main`: `apps/api/src/index.ts`, `app.ts`, `contract/env.ts`, `wrangler.jsonc`, the `/health` route, the `libs/types` exports (`SECOND_MS`, `MINUTE_MS`, `HOUR_MS`, `DAY_MS`), slice 2's `WHATSAPP_WEBHOOK_PATH`, the `ratelimits` bindings and their names (slice 3), the `analytics_engine_datasets` binding (slice 4), any `rules` key, the migration file names, the Durable Object SQL version list, the R2 key helper and the signed link path. Record each difference in `tester-briefing.md` and correct the snippet here. — evidence: done through the merges of main (25b6596, 447848b, 3538f80) and the delta review.
~~- [ ] **R1 Signing key.** `grep -rn MEDIA_LINK_SECRET apps/api` on `main`. If the name is still `MEDIA_LINK_SECRET`, Step S0.2 renames it to `MEDIA_LINK_SIGNING_KEY`. If `main` already uses the spec name, S0.2 is dropped.~~
- [x] **R1 Signing key.** Done at Step R: `MEDIA_LINK_SIGNING_KEY` is already the name on this branch, so S0.2 is dropped.
- [x] **R2 Bindings.** Copy every binding key of `main`'s top-level `wrangler.jsonc` block into **Wrangler** below, so the parity test (C1) has the true key set. Slices 3 and 4 add `ratelimits` and `analytics_engine_datasets`. — evidence: done: ratelimits, analytics and the other binding classes are pinned by BINDING_KEYS (6e2b5ff).

## Step R results (2026-11-06)

Diff of this plan against `origin/feat/agent-inbox-core`, the base of this branch. Changed lines are struck through where they stand above; this table gives the reasons.

| Item | Plan said | Branch has | Correction |
|---|---|---|---|
| Base | `main` | `origin/feat/agent-inbox-core` (slice 1 not on `main`) | branch from slice 1 |
| Top-level block | development | production (`src/index.ts`, https origin) | production top-level; `env.development` for `wrangler dev` (decisions file) |
| `compatibility_date` | `2026-11-01` | `2026-08-15` | keep `2026-08-15` |
| Placeholder prefix | `replace-with-` | `REPLACE_WITH_PRODUCTION_D1_DATABASE_ID`, pinned by `wrangler-config.test.ts` | `REPLACE_WITH_` throughout |
| Development D1 ID | `zapbip-development` | `zapbip-connections-local`, pinned | ID unchanged; `database_name` `zapbip-development` per spec |
| R1 signing key | rename to `MEDIA_LINK_SIGNING_KEY` | already used in `contract/env.ts`, `routes/media.ts` and tests | S0.2 dropped |
| `tsx` | new root devDependency | 4.23.15 already in root `devDependencies`, used by `dev:seed` | S0.1 merges scripts only |
| Health | `routes/health.ts` | `app.get(HEALTH_PATH, …)` in `app.ts`; WI-117 asserts `toEqual({ ok: true })` | edit `app.ts`; update WI-117 |
| App factory | `createApp({ includeSimulator })` | `createApp({ extraRoutes })`; dev passes `[devOwnerRoutes]` | use `extraRoutes` |
| `Bindings` | all seven secrets typed now | slice 1 types its own bindings; WhatsApp and wake secrets have no reader yet | add only `ENVIRONMENT` |
| Adapter paths | `adapters/d1-…`, `adapters/r2-…` | `adapters/d1/`, `adapters/r2/` | paths corrected |
| DO migrations | v7 added | `account-inbox/migrations/index.ts` lists v1 only | add `v7.sql` to `ACCOUNT_INBOX_MIGRATIONS`; provider pushed in the constructor |
| Gate rows | before `apps/*` | an `apps/api/*` row exists | above `apps/api/*` |
| Placeholder bucket | checked | bucket names are fixed resource names | D1 ID is the placeholder; bucket names real from the start |
| Official number and npm version | not in plan | no constant on the branch; docs not built yet | preflight refuses docs deploy (decisions 2026-11-06); constant location `(contract: confirm at build)` |

Cross-slice checks (not this slice's code):

- **accounts-and-keys (owner decision, coordinator 2026-11-06):** revoke must close the agent's connector sockets. Checked when accounts-and-keys meets local-connector; this slice does not own it.
~~- **Spec conflict:** the spec's health check 1 expects `{ "status": "ok", "environment": … }`. The decisions file governs: `{ ok: true, environment }`. The owner-approved spec is left unedited and the owner decides.~~
- **Spec conflict (resolved at lane C):** the spec's health body is amended to `{ ok: true, environment }`; its Open questions table records it as `owner delegated 2026-11-06`.

## Assumptions (decided, owner can override)

- **A1 Binding names.** The contract names `CONNECTIONS` (D1), `MEDIA` (R2) and `ACCOUNT_INBOX` (Durable Object) are used, not the spec's `CONNECTION_DIRECTORY` and `MEDIA_BUCKET`.
- **A2 Signing key name.** `MEDIA_LINK_SIGNING_KEY`. Step R1 decides whether a rename is needed.
- **A3 Units.** `DURABLE_OBJECT_DAILY_GIGABYTE_SECONDS = 13_000`, `DURABLE_OBJECT_MEMORY_GIGABYTES = 0.125`, `gigabyteSecondsForDuration`, D1 column `gigabyte_seconds`. The spec's `gb` spelling breaks the no-acronym rule.
- **A4 Time sources.** `SECOND_MS`, `MINUTE_MS`, `HOUR_MS`, `DAY_MS` from `libs/types`. Import path `@zapbip/types` (contract: confirm at build).
- **A5 Script runner.** The root scripts run `node --env-file=.env --import tsx apps/api/scripts/<file>.ts`. `tsx` 4.23.15 is a root devDependency, published 2026-09-20.
~~- **A6 Top-level block.** Development, as in Global Constraints. `wrangler dev` runs `src/index.dev.ts`.~~
- **A6 Top-level block (corrected at Step R).** Production, as in Global Constraints. `wrangler dev --env development` runs `src/index.dev.ts`.
- **A7 Bundle tests.** Agent-inbox-core's `production-bundle.e2e.test.ts` and slice 2's no-env dry run move to `--env production`, per the decisions file.
- **A8 Placeholder IDs.** ~~`database_id` and R2 `bucket_name` in the deployed blocks are `replace-with-…` until the owner pastes real values.~~ `database_id` in the deployed blocks is `REPLACE_WITH_…` until the owner pastes a real value. R2 bucket names are fixed resource names, so they are real from the start (corrected at Step R). Preflight step 4 refuses any placeholder.
- **A9 Usage is accumulated in the Durable Object and flushed at most hourly.** Each account's `AccountInbox` times each RPC method it serves; only the Worker's resolved-connection path reaches that object, so unauthenticated requests are never counted. The object adds each duration to its day total in its own SQLite (v7). It flushes the absolute day total to D1 `usage_daily` at most once per hour per account, through the due-time provider of A21. The write is an upsert of the absolute total, so a repeated or late flush cannot double-count. A thousand calls in one hour cost at most one D1 write (test U-HOUR).
- **A10 Budget check is hourly, reads D1 only, and tolerates up to one hour of lag.** It sums `usage_daily` for today in one query and needs no account list. The budget can lag real usage by up to one hour; at `DAILY_BUDGET_WARNING_RATIO` (0.8) it logs `budget.warning` and fails the run, so the owner is emailed.
- **A21 Usage flush due time.** The flush registers a due-time provider with the object's registry. Its due time is `usageFlushDueAt({ lastFlushedAt, now })`: now when the account has never been flushed and has unflushed usage, otherwise `lastFlushedAt + HOUR_MS`. Nothing is flushed when nothing is unflushed.
- **A11 Retention is daily and reads R2 only.** `media-retention` pages the bucket with `cursor` and deletes objects uploaded more than `MEDIA_RETENTION_MS` ago. It reads no account list and deletes no history rows.
- **A12 Overlap.** Slice 1's Durable Object alarm already purges media an account references. The R2 retention cron is the backstop for objects nothing references. The two are independent; a second delete of an absent key is a no-op.
- **A13 Enum homes.** `DeployEnvironment` in `apps/api/src/operations/deploy-environment.ts`; `WorkerSecret` in `worker-secret.ts`; `ScheduledJob` in `scheduled-job.ts`.
- **A14 Cron dispatch.** A job registry run for the one `SCHEDULED_CRON` tick: each job says whether it is due at that tick (every tick, minute 0, 03:00 UTC). Any other cron throws `unknown cron`. Steps A6 and A8 below name the retired `BUDGET_CHECK_CRON` and `MEDIA_RETENTION_CRON`; they are kept as the history of the red commits.
- **A15 Simulator keys.** Phone-keyed, as the spec says: `POST /dev/owner/:phone/messages`, `GET /dev/owner/:phone/screen`, `POST /dev/owner/:phone/clock`, mounted only by `src/index.dev.ts`. The accounts-and-keys spec's `/dev/c/:secret/owner/messages` is superseded.
- **A16 Smoke connection.** Staging: the owner creates it with WhatsApp `novo agente smoke`. Development and E2E: the harness creates it through the simulator with `novo agente smoke` and reads the MCP URL from the reply on `GET /dev/owner/:phone/screen`. Both store the secret in `SMOKE_CONNECTION_SECRET`.
- **A17 Fake Graph.** The E2E harness starts the fake Graph server on a free port and passes its URL to `wrangler dev` as `--var WHATSAPP_GRAPH_BASE_URL:<url>`. The recorded fixtures live in `apps/api/test/fixtures/whatsapp/` (whatsapp-cloud-channel).
- **A18 E2E default.** The `e2e` gate runs by default in `pnpm verify`. Only real-client cases (Claude Code, Codex, live provider calls) are opt-in and owner-run.
- **A19 Dry run.** `wrangler deploy --dry-run` is assumed to need no login. If it needs one, the dry-run test is recorded `not run` in coverage honesty.
~~- **A20 Health.** Slice 1's `/health` answers `{ ok: true }`. This slice adds `environment` to the same body. Slice 1's test stays green.~~
- **A20 Health.** Slice 1's `/health` answers `{ ok: true }`. This slice adds `environment` to the same body. Slice 1's WI-117 assertion in `production-entry.test.ts` (`toEqual({ ok: true })`) is updated in lane C to `{ ok: true, environment: 'production' }`, because the body gains a key and `ok` stays `true` (corrected at Step R).

## Dependencies

| Package | Version | Where | Why |
|---|---|---|---|
| `tsx` | 4.23.15 | root `devDependencies` (new) | runs `apps/api/scripts/*.ts` under Node 24 |
| `tsx` | 4.23.15 | root `devDependencies` (already present; corrected at Step R, was marked new) | runs `apps/api/scripts/*.ts` under Node 24 |
| `wrangler` | 4.158.0 | `apps/api` devDependencies (existing) | deploy, migrate, tail, dry run |
| `hono` | 4.13.16 | `apps/api` dependencies (existing) | health route |

~~`tsx` was checked with `npm view tsx@4.23.15 version`. No other dependency changes. Step S0.1 runs `pnpm install` once.~~
`tsx` is already a root devDependency, so this slice adds no dependency. The lockfile must not change (`pnpm install --frozen-lockfile`). Corrected at Step R.

## Contract (Step 0, verbatim)

Step 0 lands these on `feat/deploy-readiness` in one commit, after Step R. Every lane builds against them. A signature change after Step 0 means a new Step 0 commit that every lane merges.

### `apps/api/src/operations/deploy-environment.ts`

```ts
export enum DeployEnvironment {
  Development = 'development',
  Staging = 'staging',
  Production = 'production',
}

export function parseDeployEnvironment(input: { value: string | undefined }): DeployEnvironment {
  void input;
  throw new Error('parseDeployEnvironment is not implemented');
}
```

Throws on `undefined` and on any value that is not one of the three.

### `apps/api/src/operations/worker-secret.ts`

```ts
export enum WorkerSecret {
  MetaAppSecret = 'META_APP_SECRET',
  WhatsAppAccessToken = 'WHATSAPP_ACCESS_TOKEN',
  WhatsAppPhoneNumberId = 'WHATSAPP_PHONE_NUMBER_ID',
  WhatsAppVerifyToken = 'WHATSAPP_VERIFY_TOKEN',
  MediaLinkSigningKey = 'MEDIA_LINK_SIGNING_KEY',
  UploadLinkSigningKey = 'UPLOAD_LINK_SIGNING_KEY',
  WakeSecretKey = 'WAKE_SECRET_KEY',
}
```

### `apps/api/src/operations/constants.ts`

```ts
import { SECOND_MS } from '@zapbip/types';

export const SCHEDULED_CRON = '*/30 * * * *';
export const BUDGET_CHECK_MINUTE = 0;
export const MEDIA_RETENTION_HOUR = 3;
export const MEDIA_RETENTION_MINUTE = 0;

export const DURABLE_OBJECT_DAILY_GIGABYTE_SECONDS = 13_000;
export const DURABLE_OBJECT_MEMORY_GIGABYTES = 0.125;
export const DAILY_BUDGET_WARNING_RATIO = 0.8;

export const PLACEHOLDER_VALUE_PREFIX = 'REPLACE_WITH_';

export const SMOKE_POLL_ATTEMPTS = 10;
export const SMOKE_POLL_INTERVAL_MS = 3 * SECOND_MS;
```

### `apps/api/src/operations/scheduled-job.ts`

```ts
export enum ScheduledJob {
  BudgetCheck = 'budget_check',
  MediaRetention = 'media_retention',
}
```

### `apps/api/src/operations/scheduled.ts`

```ts
import type { Bindings } from '../contract/env';

export async function runScheduled(input: { cron: string; now: number; env: Bindings }): Promise<void> {
  void input;
  throw new Error('runScheduled is not implemented');
}
```

### `apps/api/src/account-inbox/usage-meter.ts`

```ts
export function gigabyteSecondsForDuration(input: { durationMs: number }): number {
  void input;
  throw new Error('gigabyteSecondsForDuration is not implemented');
}

export function isBudgetWarning(input: { gigabyteSeconds: number }): boolean {
  void input;
  throw new Error('isBudgetWarning is not implemented');
}

export function usageFlushDueAt(input: { lastFlushedAt: number | null; now: number }): number {
  void input;
  throw new Error('usageFlushDueAt is not implemented');
}

export function utcDay(input: { now: number }): string {
  void input;
  throw new Error('utcDay is not implemented');
}
```

`AccountInbox` wraps each RPC method with the meter. The Step 0 wrapper is a pass-through, so no existing test changes.

### `apps/api/src/operations/usage-repository.ts`

```ts
export interface UsageRepository {
  reportDay(input: { day: string; accountId: string; gigabyteSeconds: number }): Promise<void>;
  readDayTotal(input: { day: string }): Promise<number>;
}
```

The D1 implementation is `apps/api/src/adapters/d1/d1-usage-repository.ts` (Lane A; corrected at Step R, D1 adapters live under `adapters/d1/`).

### `apps/api/src/contract/env.ts`

```ts
import type { AccountInbox } from '../account-inbox/account-inbox';

export type Bindings = {
  ACCOUNT_INBOX: DurableObjectNamespace<AccountInbox>;
  CONNECTIONS: D1Database;
  MEDIA: R2Bucket;
  ENVIRONMENT: string;
  PUBLIC_ORIGIN: string;
  MEDIA_LINK_SIGNING_KEY: string;
  UPLOAD_LINK_SIGNING_KEY: string;
};
```

Additive (corrected at Step R): this slice adds only `ENVIRONMENT` to the existing `Bindings`, and the block keeps `PUBLIC_ORIGIN`, `MEDIA_LINK_SIGNING_KEY` and `UPLOAD_LINK_SIGNING_KEY` as slice 1 declared them. The WhatsApp and wake secrets are typed by the slices that read them (slices 2 to 5), so no binding is typed before it is read. The seven `WorkerSecret` names remain the list preflight checks.

### `apps/api/src/index.ts` (addition, keeps `export { AccountInbox }`; `createApp` takes `extraRoutes`, as slice 1 wrote it)

```ts
export default {
  fetch: (request: Request, env: Bindings) => createApp({ extraRoutes: [] }).fetch(request, env),
  scheduled: async (controller: ScheduledController, env: Bindings): Promise<void> => {
    await runScheduled({ cron: controller.cron, env, now: Date.now() });
  },
};
```

`index.dev.ts` keeps `createApp({ extraRoutes: [devOwnerRoutes] })` and gains the same `scheduled` export.

### `apps/api/src/app.ts` (health line; corrected at Step R, `routes/health.ts` does not exist)

The body becomes `{ ok: true, environment }`, where `environment` is `parseDeployEnvironment({ value: env.ENVIRONMENT })`. Slice 1's assertions keep passing because `ok` stays `true`.

### Root `package.json` scripts (devDependency unchanged: `tsx` is already present)

```json
{
  "scripts": {
    "deploy:staging": "node --env-file=.env --import tsx apps/api/scripts/deploy.ts --environment staging",
    "deploy:production": "node --env-file=.env --import tsx apps/api/scripts/deploy.ts --environment production",
    "migrate:development": "pnpm --filter @zapbip/api exec wrangler d1 migrations apply zapbip-development --env development --local",
    "migrate:staging": "pnpm --filter @zapbip/api exec wrangler d1 migrations apply zapbip-staging --env staging --remote",
    "migrate:production": "pnpm --filter @zapbip/api exec wrangler d1 migrations apply zapbip-production --env production --remote",
    "smoke:development": "node --env-file=.env --import tsx apps/api/scripts/smoke.ts --environment development",
    "smoke:staging": "node --env-file=.env --import tsx apps/api/scripts/smoke.ts --environment staging",
    "smoke:production": "node --env-file=.env --import tsx apps/api/scripts/smoke.ts --environment production"
  }
}
```

### Root env example and gitignore

`.env.example` (root, new) lists the seven `WorkerSecret` names and the three smoke inputs `SMOKE_BASE_URL`, `SMOKE_CONNECTION_SECRET`, `SMOKE_OWNER_PHONE`, each with a `REPLACE_WITH_…` value (corrected at Step R). `.gitignore` gains `.dev.vars`.

### `scripts/verify-gates.tsv` (rows above `apps/api/*`; corrected at Step R, the existing `apps/api/*` row would otherwise cover the wrangler file)

```
.env.example	product	unit
apps/api/wrangler.jsonc	product	typecheck unit integration
```

`tools/repository-shape/src/delivery-docs.test.ts` `ROOT_ENTRIES` gains `.env.example`.

### `docs/adr/`

ADRs 0026 and 0027 are copied from the spec's feature stash, with their rows in `docs/adr/README.md`.

### Wrangler (corrected at Step R; replaces the earlier development-first shape)

The top-level block is production, as slice 1 shipped it. `env.development` runs `wrangler dev`. Every block repeats every binding key, because wrangler does not inherit them. `REPLACE_WITH_…` marks the one ID the owner pastes; R2 bucket names are fixed resource names.

```json
{
  "name": "zapbip-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-15",
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  "workers_dev": false,
  "preview_urls": false,
  "durable_objects": { "bindings": [{ "name": "ACCOUNT_INBOX", "class_name": "AccountInbox" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["AccountInbox"] }],
  "d1_databases": [{ "binding": "CONNECTIONS", "database_name": "zapbip-production", "database_id": "REPLACE_WITH_PRODUCTION_D1_DATABASE_ID", "migrations_dir": "migrations" }],
  "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "zapbip-media-production" }],
  "rules": [{ "type": "Text", "globs": ["**/*.sql"], "fallthrough": true }],
  "routes": [{ "pattern": "mcp.zapbip.com", "custom_domain": true }],
  "vars": { "ENVIRONMENT": "production", "PUBLIC_ORIGIN": "https://mcp.zapbip.com", "WAITLIST_ENABLED": "true", "WHATSAPP_GRAPH_BASE_URL": "https://graph.facebook.com" },
  "triggers": { "crons": ["*/30 * * * *"] },
  "env": {
    "development": {
      "name": "zapbip-api-development",
      "main": "src/index.dev.ts",
      "durable_objects": { "bindings": [{ "name": "ACCOUNT_INBOX", "class_name": "AccountInbox" }] },
      "migrations": [{ "tag": "v1", "new_sqlite_classes": ["AccountInbox"] }],
      "d1_databases": [{ "binding": "CONNECTIONS", "database_name": "zapbip-development", "database_id": "zapbip-connections-local", "migrations_dir": "migrations" }],
      "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "zapbip-media-development" }],
      "rules": [{ "type": "Text", "globs": ["**/*.sql"], "fallthrough": true }],
      "vars": { "ENVIRONMENT": "development", "PUBLIC_ORIGIN": "http://localhost:8787", "WAITLIST_ENABLED": "false", "WHATSAPP_GRAPH_BASE_URL": "http://127.0.0.1:8788" },
      "triggers": { "crons": ["*/30 * * * *"] }
    },
    "staging": {
      "name": "zapbip-api-staging",
      "main": "src/index.ts",
      "durable_objects": { "bindings": [{ "name": "ACCOUNT_INBOX", "class_name": "AccountInbox" }] },
      "migrations": [{ "tag": "v1", "new_sqlite_classes": ["AccountInbox"] }],
      "d1_databases": [{ "binding": "CONNECTIONS", "database_name": "zapbip-staging", "database_id": "REPLACE_WITH_STAGING_D1_DATABASE_ID", "migrations_dir": "migrations" }],
      "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "zapbip-media-staging" }],
      "rules": [{ "type": "Text", "globs": ["**/*.sql"], "fallthrough": true }],
      "routes": [{ "pattern": "mcp-staging.zapbip.com", "custom_domain": true }],
      "vars": { "ENVIRONMENT": "staging", "PUBLIC_ORIGIN": "https://mcp-staging.zapbip.com", "WAITLIST_ENABLED": "false", "WHATSAPP_GRAPH_BASE_URL": "https://graph.facebook.com" },
      "triggers": { "crons": ["*/30 * * * *"] }
    }
  }
}
```

The `ratelimits` and `analytics_engine_datasets` keys from slices 3 and 4 are repeated in all three blocks when those slices land. The crons are the same in all three blocks. The development `database_id` stays `zapbip-connections-local`, which slice 1's wrangler test pins.

## File map (lanes)

Every path has exactly one owner. Step 0 owns the shared files; later edits to them are additive.

| Lane | Developer | Owned paths |
|---|---|---|
| S0 Contract (serial) | `developer-0` | `apps/api/src/operations/{deploy-environment,worker-secret,constants,scheduled-job,scheduled,usage-repository}.ts` (signatures and stubs), `apps/api/src/account-inbox/usage-meter.ts` (stub), `apps/api/src/contract/env.ts` (additive), `apps/api/src/index.ts` and `index.dev.ts` (additive `scheduled`), root `package.json`, `pnpm-lock.yaml`, `.env.example`, `.gitignore`, `scripts/verify-gates.tsv`, `tools/repository-shape/src/delivery-docs.test.ts` (ROOT_ENTRIES), `docs/adr/0026-*.md`, `docs/adr/0027-*.md`, `docs/adr/README.md`, (no R1 rename: the name is already in use) |
| C Config and health | `developer-C` | `apps/api/wrangler.jsonc` (restructured to the parity shape), `apps/api/src/app.ts` (health line), `apps/api/test/unit/wrangler-config.test.ts`, `apps/api/test/integration/{health,deploy-dry-run}.test.ts`, `apps/api/test/integration/production-entry.test.ts` (WI-117 assertion), `apps/api/test/e2e/production-bundle.e2e.test.ts` (`--env production` only) |
| A Usage and jobs | `developer-A` | `apps/api/src/account-inbox/usage-meter.ts` (body), `apps/api/src/account-inbox/**` (RPC wrapper and v7 schema, additive), `apps/api/src/operations/{budget-check,media-retention,scheduled}.ts` (bodies), `apps/api/src/adapters/d1/d1-usage-repository.ts`, `apps/api/src/adapters/r2/r2-media-listing.ts`, `apps/api/migrations/0003_usage.sql`, `apps/api/test/unit/{usage-meter,scheduled,media-retention}.test.ts`, `apps/api/test/integration/{usage-repository,usage-in-object,usage-security,scheduled}.test.ts` |
| B Deploy, smoke and E2E | `developer-B` | `apps/api/scripts/{deploy,smoke}.ts`, `apps/api/src/operations/{deploy-preflight,terminal-shell,smoke-checks,smoke-inputs,simulator-client,signed-webhook,fake-graph-harness}.ts`, `apps/api/test/unit/{deploy-preflight,deploy-entry,smoke-checks,smoke-inputs,env-example,terminal-shell,root-scripts,signed-webhook}.test.ts`, `apps/api/test/e2e/{smoke-development,owner-flow}.e2e.test.ts` |
| D Runbooks | `developer-D` | `docs/runbooks/**`, `tools/repository-shape/src/runbooks.test.ts` |

Ownership notes:

- Lane B's helpers (`simulator-client`, `signed-webhook`, `fake-graph-harness`) are owned by B; Lane A's integration tests may import them after B merges.
- `apps/api/test/support/**` belongs to slice 1 and is read-only here.

## Sequencing and merge order

1. **Step R (refresh)** on the branch, with `main` checked out in a separate worktree. Its corrections are committed as `docs(deploy): refresh the plan against main`.
2. **Step S0 (serial).** Lead lands the contract commits, runs `pnpm install` once, then `pnpm typecheck` and `pnpm verify` green.
3. **Parallel after S0:** lanes C, A, B and D start from the S0 commit in their own worktrees.
4. **Merge order:** S0 → C → A → B → D. Lane A's integration tests read D1 `migrations_dir` and the development block, which C writes. Lane B's E2E runs `wrangler dev` on the development block, so it needs C too. D can merge at any point after S0.
5. **Lead merges after each lane:** `pnpm typecheck` and `pnpm verify` green before the next merge.

Lanes never rebase: a rebase would rewrite the red-first hashes the test plan cites.

## Steps

### Step R (plan refresh)

- [x] **R0 Diff against main.** Check each contract snippet and file-map path against `main` as listed in **Plan refresh against main**. Correct this file. Commit as `docs(deploy): refresh the plan against main`. — evidence: done through the merges of main (25b6596, 447848b, 3538f80) and the delta review.
~~- [ ] **R1 Signing key.** Decide whether S0.2 renames `MEDIA_LINK_SECRET`.~~
- [x] **R1 Signing key.** Done at Step R: `MEDIA_LINK_SIGNING_KEY` is already the name on this branch, so S0.2 is dropped.
- [x] **R2 Bindings.** Write the complete binding key set of `main`'s top-level block into **Wrangler** in this file. — evidence: done: ratelimits, analytics and the other binding classes are pinned by BINDING_KEYS (6e2b5ff).

### S0 (developer-0): contract

~~- [ ] **S0.1 Scaffold.** Add `tsx` 4.23.15 to the root `devDependencies` and merge the root scripts into `package.json`. Run `pnpm install` once; commit `pnpm-lock.yaml`. Commit as `chore(deps): add tsx for the deploy and smoke scripts`.~~
- [x] **S0.1 Scaffold (corrected at Step R).** Merge the root scripts into `package.json`. `tsx` 4.23.15 is already a root devDependency. Run `pnpm install --frozen-lockfile`; the lockfile must not change. Commit as `chore(api): add the deploy and smoke root scripts`. — evidence: c7048b1
~~- [ ] **S0.2 Rename (only if R1 says so).** Rename `MEDIA_LINK_SECRET` to `MEDIA_LINK_SIGNING_KEY` in every file that uses it. Commit as `refactor(api): name the media link key after its secret`.~~
- [x] **S0.2 Rename (dropped at Step R).** R1 found no rename to make.
- [x] **S0.3 Contract files.** Write each file in **Contract** verbatim, with stub bodies where the contract shows a throw. Add the `scheduled` export to `index.ts` and `index.dev.ts`, keeping `export { AccountInbox }`. Add the meter wrapper to `AccountInbox` as a pass-through. Run `pnpm typecheck` and slice 1's integration tests; they stay green. Commit as `feat(api): land the deploy-readiness contract`. — evidence: 2dc88a2
- [x] **S0.4 Env and gates.** Write the root env example, add `.dev.vars` to `.gitignore`, add the two gate rows, add `.env.example` to `ROOT_ENTRIES`. Run `pnpm test:verify` and the repository-shape unit tests. Commit as `chore(env): add the environment example and its gate rows`. — evidence: d4e6d60
- [x] **S0.5 ADRs.** Copy ADRs 0026 and 0027 and their index rows. Run the document-index test. Commit as `docs(adr): record the runbook and deploy decisions`. — evidence: 2f13106

### C (developer-C): config and health

- [x] **C1 red: wrangler parity.** `apps/api/test/unit/wrangler-config.test.ts` reads `wrangler.jsonc` with `JSON.parse` and asserts the rules of the test plan's **Config** section, including key-set parity of every binding across the three blocks, the var keys, the crons, the routes and the names. Expected failure: one block and no `env` key. Commit as `test(api): pin the three wrangler environments`. — evidence: 99caf63 (red: SyntaxError, trailing commas and no env.staging; the suite fails to load)
- [x] **C2 green: wrangler.** Restructure `apps/api/wrangler.jsonc` to the shape in **Wrangler**, repeating every key in the staging and production blocks, with `replace-with-…` placeholders for the deployed IDs. Commit as `feat(api): declare the development, staging and production blocks`. — evidence: 5f0cbe9 (wrangler-config 18/18; the integration suite 184/184; file written with `prettier --trailing-comma none`, see tester-briefing)
- [x] **C3 red then green: health.** `apps/api/test/integration/health.test.ts`: `GET /health` returns `{ ok: true, environment }`; an unknown `ENVIRONMENT` returns a Worker error; slice 1's health assertions also run. Red first, then the body in `apps/api/src/app.ts` (the `/health` line; corrected at Step R, `routes/health.ts` does not exist). Lane C also updates the WI-117 assertion in `production-entry.test.ts` to `{ ok: true, environment: 'production' }`. Commit red and green separately. — evidence: red b3279ef, green 3637a4c. Ownership change (coordinator 2026-11-06): lane C also owns `apps/api/src/operations/deploy-environment.ts` and implements `parseDeployEnvironment` (test `apps/api/test/unit/deploy-environment.test.ts`, red then green).
~~- [ ] **C4 bundle tests.** `apps/api/test/e2e/production-bundle.e2e.test.ts` and slice 2's no-env dry run run with `--env production`. Assertions stay. Commit as `test(api): bundle the production environment`.~~
- [x] **C4 bundle tests (struck at lane C).** The top level is production, so `--env production` fails with "No environment found in configuration with name production". PB-1 already bundles the top level. PB-4 adds the staging bundle. — evidence: pin, test(api) commit for PB-4 (3/3 in production-bundle.e2e)
~~- [ ] **C5 red then green: dry run.** `apps/api/test/integration/deploy-dry-run.test.ts`: `wrangler deploy --dry-run --env staging` and `--env production` exit `0`; each bundle lacks `/dev/owner/`. Commit red and green separately.~~
- [x] **C5 dry run (moved).** The workerd integration pool has no `child_process`, so the dry run for staging lives in `apps/api/test/e2e/production-bundle.e2e.test.ts` as PB-4 (exit 0, no `/dev/owner/`); production is PB-1. Green on landing, a pin.

### A (developer-A): usage and jobs

- [x] **A1 red then green: arithmetic.** `apps/api/test/unit/usage-meter.test.ts`: the arithmetic rules of the test plan. Implement `gigabyteSecondsForDuration`, `isBudgetWarning` and `utcDay`. Commit red and green separately. — evidence: red 6930ad6, green 358e082
- [x] **A2 migration.** `apps/api/migrations/0003_usage.sql`: `CREATE TABLE usage_daily (day TEXT NOT NULL, account_id TEXT NOT NULL, gigabyte_seconds REAL NOT NULL, PRIMARY KEY (day, account_id));`. Commit as `feat(api): add the usage_daily migration`. — evidence: fff8c08
- [x] **A3 red then green: D1 repository.** `apps/api/test/integration/usage-repository.test.ts`: `reportDay` upserts the absolute total for `(day, accountId)`; `readDayTotal` sums every account for the day; an empty day returns `0`. Implement `d1-usage-repository.ts` with bound parameters only. Commit red and green separately. — evidence: red 6d10114, green 0cf7989
- [x] **A4 red then green: meter in the object.** `apps/api/test/integration/usage-in-object.test.ts`: a resolved MCP call through `SELF.fetch` adds its duration to the object's day total in SQLite and arms the alarm at `usageFlushDueAt`; the first flush after the due time writes the absolute total to `usage_daily`; a second call inside the hour writes nothing. Add the v7 schema (additive; `apps/api/src/account-inbox/migrations/v7.sql`, listed in `ACCOUNT_INBOX_MIGRATIONS`), the RPC wrapper that times each method, and the due-time provider pushed onto `dueTimeProviders` in the `AccountInbox` constructor (`apps/api/src/account-inbox/account-inbox.ts`; corrected at Step R). Commit red and green separately. — evidence: red 1b5d79d, green c06ab52 (also edits slice 1 account-inbox.test.ts: WI-118 expects versions [1, 7]; the alarm-deadline test clears usage_meter first)
- [x] **A5 red then green: security.** `apps/api/test/integration/usage-security.test.ts` (the Security section of the test plan): requests with an unknown, revoked or malformed secret leave `usage_daily` and the object's counter unchanged. Commit red and green separately. — evidence: c22e6ef (pin: green on landing, the Worker answers 401 before the stub)
- [x] **A6 red then green: budget check.** `budget-check.ts` reads `readDayTotal`, logs `budget.warning` with the day and the total at or above the threshold, and throws so the run fails. Red in `scheduled.test.ts`. Commit red and green separately. — evidence: done with A8: red cfcda2b, green 043b2f3 (budget cases live in scheduled.test.ts as the step says)
- [x] **A7 red then green: media retention.** `apps/api/test/unit/media-retention.test.ts`: a fake bucket that pages (1,001 objects, page size 1,000). `media-retention.ts` lists through `r2-media-listing.ts`, recursing on `cursor`, and deletes objects uploaded before `now - MEDIA_RETENTION_MS`. Commit red and green separately. — evidence: red 244cb3b, green 9b72906 (done before A6/A8 so the dispatch has its retention body)
- [x] **A8 red then green: dispatch.** `apps/api/test/unit/scheduled.test.ts`: `BUDGET_CHECK_CRON` runs the budget check only; `MEDIA_RETENTION_CRON` runs retention only; an unknown cron throws. `scheduled.ts` dispatches from a record keyed by the cron. Commit red and green separately. — evidence: red cfcda2b, green 043b2f3
- [x] **A9 integration.** `apps/api/test/integration/scheduled.test.ts`: seeded `usage_daily` rows and seeded R2 objects; `runScheduled` for each cron with `now` moved forward. Commit as `test(api): run the two crons against seeded data`. — evidence: bb99d7c

### B (developer-B): deploy, smoke and E2E

- [x] **B1 red then green: preflight.** `apps/api/test/unit/deploy-preflight.test.ts`: one case per refusal in steps 1 to 7, with a fake `DeployShell`, and two docs cases: the official number sentinel and an unresolved `npm view zapbip@<version>` (decisions 2026-11-06). Implement `deploy-preflight.ts` as an ordered list of named steps; the first failure is returned. Commit red and green separately. Evidence: red 035a101, green e0d373d; readiness check red 8299f89, green 4daed72; smoke inputs red a87ae42, green 5b87746.
- [x] **B2 red then green: confirmation and dry run.** `apps/api/test/unit/deploy-entry.test.ts`: only the exact answer `production` proceeds on production. `scripts/deploy.ts` exposes `runDeploy({ environment, shell, prompt, isInteractive, environmentVariables })`. Commit red and green separately. Evidence: red e858eb6, green b71cd55.
- [x] **B3 red then green: terminal shell.** `apps/api/test/unit/terminal-shell.test.ts`: `spawn` with an argument array and no shell; a secret value goes to stdin and never appears in the arguments. Commit red and green separately. Evidence: red 97e2fa9, green af85cbb.
- [x] **B4 red then green: smoke inputs.** `apps/api/test/unit/smoke-inputs.test.ts`: each of `SMOKE_BASE_URL`, `SMOKE_CONNECTION_SECRET`, `SMOKE_OWNER_PHONE` and `META_APP_SECRET`, when missing, empty or a placeholder, produces an error naming it. Commit red and green separately. Evidence: red a87ae42, green 5b87746.
- [x] **B5 red then green: signed webhook.** `apps/api/test/unit/signed-webhook.test.ts`: `buildSignedWebhookPost({ appSecret, ownerWaId, phoneNumberId, text, nonce, timestamp })` returns the exact body and header in **Signed Meta payload**. Commit red and green separately. Evidence: red a5ecc58, green 461f7c6.
- [x] **B6 red then green: smoke checks.** `apps/api/test/unit/smoke-checks.test.ts` with a fake `SmokeFetch`: five checks; production runs checks 1 to 4 only. Commit red and green separately. Evidence: red 9b92c0c, green 02aa9b3.
- [x] **B7 green: smoke entry.** `scripts/smoke.ts` prints `PASS` or `FAIL`, the code and the name, never a secret, and exits non-zero on any `FAIL`. Commit as `feat(api): add the smoke test script`. Evidence: tests 99a1f7f, green 94ca0b7.
- [x] **B8 red then green: env example and root scripts.** `env-example.test.ts` and `root-scripts.test.ts` as the test plan's Environment section. Commit red and green separately. Evidence: pin 19d03f1.
- [x] **B9 red then green: simulator client and fake Graph.** `simulator-client.ts` posts to `/dev/owner/:phone/messages` and reads `/dev/owner/:phone/screen`. `fake-graph-harness.ts` starts the recorded-fixture server on a free port and returns its base URL. Commit red and green separately. Evidence: red 963cda2, green c4ecf97.
- [x] **B10 E2E (default gate).** `apps/api/test/e2e/owner-flow.e2e.test.ts` and `apps/api/test/e2e/deploy-dry-run.e2e.test.ts`, both on the whatsapp e2e stack (`vitest.e2e-whatsapp.config.mts`): the simulator answers `novo agente smoke` with an install link; `smoke.ts --environment development` prints five `PASS`, `--first-deploy` prints three, a wrong secret fails two and exits 1; `wrangler deploy --dry-run` of production and staging lists every binding; `runDeploy` with the real constants refuses on the unset official number, unset company facts, an unresolved npm package and a pending D1 migration. The install page is install-skills' route, so the smoke reads the seeded secret, not one from the screen. Pins: the code under test already exists. Evidence: the commit that adds both files.

### D (developer-D): runbooks

- [x] **D1 red: runbook shape.** `tools/repository-shape/src/runbooks.test.ts`: the index links every runbook; links resolve; each runbook has a purpose line, numbered steps and an `If it fails` line per step; `deploy.md` contains the immutable-migration rule. Commit as `test(shape): pin the runbook index`. — evidence: 1465f0b
- [x] **D2 green: runbooks.** Write `docs/runbooks/README.md`, `cloudflare-setup.md`, `dns.md`, `meta-setup.md`, `deploy.md`, `mintlify-publish.md`. Commands match the root scripts. `deploy.md` states the immutable-migration rule: a migration that has reached a deployed environment is never edited; a fix is a new numbered migration. `mintlify-publish.md` lists two owner steps before a docs deploy: set `OFFICIAL_WHATSAPP_NUMBER` in place of `OFFICIAL_NUMBER_UNSET`, and publish the exact `zapbip@<version>` to npm. Commit as `docs(runbooks): write the owner's go-live runbooks`. — evidence: 675abfa

## Signed Meta payload

The harness and `buildSignedWebhookPost` produce this shape. It is the minimum slice 2 parses.

- Request: `POST /webhooks/whatsapp`, `Content-Type: application/json`, header `X-Hub-Signature-256: sha256=<hex>`.
- The hex is HMAC-SHA-256 with key `META_APP_SECRET` over the exact raw body bytes, lowercase.
- Body:

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "<waba id>",
    "changes": [{
      "field": "messages",
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "<display number>", "phone_number_id": "<WHATSAPP_PHONE_NUMBER_ID>" },
        "contacts": [{ "profile": { "name": "<owner name>" }, "wa_id": "<owner wa_id>" }],
        "messages": [{
          "from": "<owner wa_id>",
          "id": "wamid.<nonce>",
          "timestamp": "<unix seconds as a string>",
          "type": "text",
          "text": { "body": "@smoke <nonce>" }
        }]
      }
    }]
  }]
}
```

`from` and `wa_id` are the owner's digits, the key the account is found by (ADR 0012). `phone_number_id` must equal the Worker's `WHATSAPP_PHONE_NUMBER_ID`, or slice 2 answers `200` and stores nothing.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| R0 | a snippet names a file or export that main does not have | the refresh diff lists it | correct the snippet before S0; no lane starts on a wrong name |
| S0.1 | the lockfile does not match the new devDependency | `pnpm install --frozen-lockfile` fails on a clean checkout | regenerate the lock in S0.1 only; revert the commit |
| S0.2 | the rename misses a file | `grep -rn MEDIA_LINK_SECRET apps/api` is not empty | revert and redo with the grep as the gate |
| S0.3 | the `scheduled` export or the wrapper stub breaks a slice 1 test | `pnpm test:integration` red on slice 1's integration tests | revert the S0.3 commit; re-land the contract |
| S0.4 | a gate row shadows `apps/*` | `pnpm test:verify` reports the wrong gates for `apps/api/wrangler.jsonc` | move the rows above `apps/*` |
| C2 | the top-level block change breaks the production bundle test | `production-bundle.e2e.test.ts` finds the simulator in the bundle | C4 adds `--env production`; C2 and C4 merge together |
| C2 | a binding is repeated in one deployed block only | the C1 parity test lists the missing key | repeat the key in the block |
| C3 | `environment` breaks slice 1's health assertion | slice 1's `health.test.ts` fails on `ok` | keep `ok: true` at the top level; add `environment` beside it |
| C5 | `wrangler deploy --dry-run` asks for a Cloudflare login | `deploy-dry-run.test.ts` exits non-zero with an auth message | move the dry run to `e2e` and record `not run` (A19) |
| C5 | placeholder IDs fail the dry run | the test names a `REPLACE_WITH_` value | the dry-run test checks the development block for the parse; the deployed dry runs run after the owner pastes IDs (documented in `deploy.md`) |
| A2 | the migration conflicts with a later one | `wrangler d1 migrations list --local` shows an unexpected state | a deployed migration is immutable: a fix is `0004_…` or later, never an edit |
| A4 | the alarm is not armed, so usage never reaches D1 | `usage_daily` is still empty after the due time has passed in the test clock | the write path re-arms through the registry; the test advances the clock one hour and expects exactly one row |
| A4-b | a flush is written per call instead of per hour | the write-count test sees more than one upsert in an hour | the flush runs only from the alarm, never from the write path |
| A5 | an unresolved secret reaches the object and is counted | `usage_daily` changes after a `401` | the Worker answers `401` before the stub is called; the test pins the order |
| A7 | paging leaves objects behind | the 1,001-object test deletes 1,000 and leaves 1 | recurse on `cursor` from the last page |
| B1 | step order is wrong | the test for step 2 sees the secret refusal instead | reorder the list; the test names the step numbers |
| B3 | a secret reaches `argv` | the terminal-shell test sees the value in the arguments | take the value out; stdin is the only path |
| B5 | the signed body differs from the raw bytes sent | check 5 returns `401` | sign the exact string that is sent; the test compares the two |
| B10 | the fake Graph or `wrangler dev` cannot bind a port | the E2E reports a port error | bind port `0` and read the bound port from the process |
| D1 | a runbook link drifts | `runbooks.test.ts` names the broken link | fix the link or the file name |
| Z | the owner's staging deploy hits a placeholder | preflight step 4 names it | paste the ID into `wrangler.jsonc`; nothing was deployed |

**Steps with no backout:** A2 once `0003_usage.sql` has reached a deployed environment (a fix is a later migration), and any production deploy after it succeeds (`wrangler rollback` is the only undo).

## Z. Prove and ship

- [x] **Tester briefing:** a developer wrote `tester-briefing.md` with the R0 diff lines and the commands of the Local end to end section. — evidence: tester-briefing.md written and corrected in c3d8bcd.
- [x] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence. Owner-run boxes stay unticked and labelled. — evidence: tester A and tester B at c3d8bcd; gaps fixed in 6e2b5ff and the docs commit that follows.
- [x] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`. — evidence: verdict SHIP WITH RESERVATIONS, three minors fixed in c3d8bcd; security re-check CLEAR.
- [x] **/check-ui:** not applicable; this slice adds no UI.
- [x] **/open-pr:** gates passed, learnings sweep: none new, PR #13 opened.
