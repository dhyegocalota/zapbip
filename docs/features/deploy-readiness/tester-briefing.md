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

## Lane C (config and health)

Commits: `99caf63` (red, wrangler-config), `5f0cbe9` (wrangler.jsonc), `b3279ef` (red, health and WI-117), the PB-4 pin, and the spec/plan commit. Health green (C3) is not landed: see Gaps.

### What changed

- `apps/api/wrangler.jsonc` — top level is production; `env.development` and `env.staging` repeat every binding; JSONC formatted by the repository Prettier.
- `apps/api/test/unit/wrangler-config.test.ts` — 18 cases: block values, key-set parity per binding class, vars parity, migrations, crons, placeholders.
- `apps/api/test/integration/health.test.ts`, `production-entry.test.ts` (WI-117 now `{ ok: true, environment: 'production' }`; the helper passes `ENVIRONMENT: production`).
- `apps/api/test/e2e/production-bundle.e2e.test.ts` — PB-4, the staging dry-run bundle (pin).
- `docs/features/deploy-readiness/spec.md` — health body amended to `{ ok: true, environment }`.
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
cd apps/api && pnpm exec vitest run --config vitest.unit.config.mts wrangler-config
cd apps/api && pnpm exec vitest run --config vitest.integration.config.mts health production-entry
cd apps/api && pnpm exec vitest run --config vitest.e2e.config.mts production-bundle
cd apps/api
pnpm exec vitest run --config vitest.unit.config.mts test/unit/usage-meter.test.ts test/unit/media-retention.test.ts test/unit/scheduled.test.ts
pnpm exec vitest run --config vitest.integration.config.mts test/integration/usage-repository.test.ts test/integration/usage-in-object.test.ts test/integration/usage-security.test.ts test/integration/scheduled.test.ts
```

### Red today, green after

| Test | Red text | Green after |
|---|---|---|
| `wrangler-config.test.ts` (whole suite) | `SyntaxError: Expected double-quoted property name in JSON at position 293 (line 9 column 3)` (trailing commas, no `env.staging`) | `5f0cbe9`, 18/18 |
| `health.test.ts::names the configured environment` | `expected { ok: true } to deeply equal { ok: true, environment: 'staging' }` | needs the `app.ts` health line and the `parseDeployEnvironment` body |
| `health.test.ts::an unknown environment is a Worker error…` | `expected 200 to be 500` | same |
| `production-entry.test.ts::WI-117` | `expected { ok: true } to deeply equal { ok: true, environment: 'production' }` | same |

Pins: the first four wrangler-config cases, PB-4.

### Hypotheses to attack

1. `wrangler deploy --dry-run` (no flag) is the production bundle and `--env staging` the staging bundle; both exit 0 with placeholder D1 ids and no login. Break it by running both.
2. `--env production` is refused by wrangler ("No environment found in configuration with name production"). Any script that passes it (the deploy command, the runbooks) is wrong; production deploys with no `--env`.
3. Every binding class is identical across the three blocks. Break it by deleting `rules` from one block.

### Update (coordinator decisions 2026-11-06)

- Health green landed in `3637a4c`: `parseDeployEnvironment` implemented (lane C now owns `deploy-environment.ts`), `/health` answers `{ ok: true, environment }`, an unknown `ENVIRONMENT` is a 500.
- `wrangler.jsonc` is formatted by the repository Prettier (trailing commas allowed). `wrangler-config.test.ts` reads it with wrangler's `experimental_readRawConfig`. Lane B's preflight must read it the same way (import that function) and never `JSON.parse` it.
- The first deploy-environment red text: `Error: parseDeployEnvironment is not implemented`.

### Gaps

- `ratelimits` and `analytics_engine_datasets` parity is not asserted; neither key exists yet.
- The deploy command and runbooks must not use `--env production` (plan A7 and the production-bundle line were stale).
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

## Lane B: deploy, smoke and helpers (steps B1 to B9; B10 blocked)

### What changed and where

- `apps/api/src/operations/deploy-preflight.ts`: `runWorkerPreflight` (ordered steps: environment and terminal, official number, git, gate, config placeholders, production readiness, secrets, migrations, smoke inputs; the first refusal is returned) and `runDocsPreflight` (official number, then `npm view zapbip@<version>`). Shell and npm lookups go through an injected `DeployShell`, so tests never touch the network.
- `apps/api/src/operations/{smoke-inputs,smoke-checks,signed-webhook,terminal-shell,worker-facts,simulator-client,fake-graph-harness}.ts`.
- `apps/api/scripts/deploy.ts` (`runDeploy`, `readDeployBlock`) and `apps/api/scripts/smoke.ts` (`runSmoke`); both run `main` only under `import.meta.main`.
- `libs/types/src/constants.ts`: `OFFICIAL_NUMBER_UNSET`, `OFFICIAL_WHATSAPP_NUMBER` (the sentinel), `ZAPBIP_NPM_VERSION = '0.1.0'`; `apps/api/src/contract/constants.ts`: `WHATSAPP_WEBHOOK_PATH`. Same names and values as the slices that own them, defined here because they are not on this branch.
- Test helpers: `test/unit/fake-deploy-shell.ts`, `test/unit/fake-smoke-stack.ts`. Extra test files beyond the plan: `worker-facts`, `smoke-entry`, `simulator-client`, `fake-graph-harness`.

### How to run

```
cd apps/api && pnpm exec vitest run --config vitest.unit.config.mts
node --import tsx apps/api/scripts/deploy.ts --environment development   # refuses, runs no command
```

### Red today, green after (failure text of the red runs)

| Test file | Red text | Green |
|---|---|---|
| `smoke-inputs.test.ts` | `expected [Function] to throw error including 'SMOKE_BASE_URL' but got 'readSmokeInputs is not implemented'` | `5b87746` |
| `deploy-preflight.test.ts` | `Error: runWorkerPreflight is not implemented` / `runDocsPreflight is not implemented` | `e0d373d` |
| `worker-facts.test.ts` | `Error: inspectWorkerSource is not implemented` | `4daed72` |
| `terminal-shell.test.ts` | `Error: createTerminalShell is not implemented` | `af85cbb` |
| `signed-webhook.test.ts` | `Error: buildSignedWebhookPost is not implemented` | `461f7c6` |
| `smoke-checks.test.ts` | `Error: runSmokeChecks is not implemented` | `02aa9b3` |
| `deploy-entry.test.ts` | `Error: runDeploy is not implemented` / `readDeployBlock is not implemented` | `b71cd55` |
| `smoke-entry.test.ts` | `Error: runSmoke is not implemented` | `94ca0b7` |
| `simulator-client.test.ts`, `fake-graph-harness.test.ts` | `postOwnerText` / `startFakeGraph is not implemented` | `c4ecf97` |

Pins (green on arrival): `env-example.test.ts`, `root-scripts.test.ts` (`19d03f1`). Unit suite: 18 files, 178 tests green; `pnpm typecheck` green.

### Decisions and deviations (tester: attack these)

1. Production is never given `--env`: `wranglerCommand` omits the flag for production. The root scripts' `--environment production` is read only by `parseDeployEnvironment`.
2. `OFFICIAL_WHATSAPP_NUMBER === OFFICIAL_NUMBER_UNSET` refuses every deploy (Worker and docs), right after the environment check and before any command.
3. Coordinator addition: production is refused unless the source exports `scheduled` (regex on `src/index.ts`), `wrangler` has a cron trigger in the top-level block, and a `src` file contains `/i/:installCode`. Staging is not held to it. This is a source-text check, not a bundle inspection; a route declared through a constant would be missed.
4. `--first-deploy` also exists on `deploy.ts` (not in the plan): without it the preflight smoke-input step would refuse the first deploy because `SMOKE_CONNECTION_SECRET` is still a placeholder. It is forwarded to `smoke.ts`, which skips checks 2 and 5 and prints how to create the smoke connection and re-run.
5. `runDeploy` takes `block`, `workerFacts`, `officialWhatsAppNumber`, `firstDeploy` and `log` besides the planned parameters, so tests need no files.
6. Smoke needs `WHATSAPP_VERIFY_TOKEN` (check 3) and `WHATSAPP_PHONE_NUMBER_ID` (check 5; a wrong id makes the Worker answer 200 and store nothing) from `.env`; both are already in `.env.example`.
7. Check 3 prints one line; its status is the right-token response (`PASS 200`), and a wrong token must be refused with 401 or 403. The test plan's "PASS 403 webhook verify" row is covered as the wrong-token half of that one line.
8. Step 9 reads `wrangler versions list --json` and takes the LAST entry: wrangler sorts versions oldest first (cli.js `versionsListHandler`), so the plan's "first entry" would be the oldest. D1 bookmark comes from `d1 time-travel info <db> --json`. The rollback commands printed on smoke failure are `wrangler rollback <version>` and `wrangler d1 time-travel restore <db> --bookmark=<id>`; the script never runs them.
9. The terminal shell's unit test fakes the spawn boundary; the "no `shell: true`" property rests on the default adapter `spawnPiped`, which passes only `stdio`.

### Hypotheses for the tester

- `node --import tsx apps/api/scripts/smoke.ts --environment staging` with an empty environment prints every missing input name and sends no request.
- A production preflight with HEAD one commit ahead of `origin/main` is refused at git, after `git fetch origin main`.
- No output line of `smoke.ts` ever contains `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` or the connection secret, even when every request fails.

### Gaps

- B10 (E2E owner flow and `smoke-development`) is not written: the dev stack has no `/webhooks/whatsapp` route (whatsapp-cloud-channel) and no `novo agente` flow (accounts-and-keys, whose install reply carries an install link rather than the MCP URL, so `mcpSecretOf` will need the `/i/<code>` step). Needed at that merge: smoke check 2 expects `Object.values(McpToolName)`, which becomes eleven when `set_wake` joins the enum.
- The `wrangler ... --json` output shapes for `versions list`, `time-travel info` and `secret list --format json` are read from wrangler's source, not from a live account.
- `SignatureHeader` is declared in `signed-webhook.ts`; whatsapp-cloud-channel declares `WEBHOOK_SIGNATURE_HEADER` in its adapter. Merge by importing one.
## Lane D (runbooks)

- Changed: `docs/runbooks/{README,cloudflare-setup,dns,meta-setup,deploy,mintlify-publish}.md`, `tools/repository-shape/src/runbooks.test.ts`.
- Run: `pnpm --filter @zapbip/repository-shape exec vitest run src/runbooks.test.ts`.
- Red (1465f0b): 3 failed, 6 passed; `ENOENT ... docs/runbooks/README.md` and `deploy.md`. Green: 9 of 9 in the file, 71 of 71 in the package.
- Hypotheses: every step has Expect and If it fails lines; the README order matches the test plan; every `pnpm <script>` is a root script; production commands carry no `--env` (lane C binding).
- Gaps:
  - Resource names follow the spec table (`zapbip-staging`, `zapbip-production`, `zapbip-media-*`); lane C's `wrangler.jsonc` must match.
  - The first deploy of an environment fails smoke checks 2 and 5 (no smoke connection yet) and `SMOKE_CONNECTION_SECRET=pending` is needed to pass preflight step 7; lane B may prefer a cleaner path.
  - `OFFICIAL_WHATSAPP_NUMBER` lives in `libs/types/src/constants.ts` per docs-experience; the `zapbip` package path `apps/connector` and its `private: true` come from local-connector; neither is on this branch.
  - Meta and Mintlify UI labels are from memory and unverified; the runbooks tell the owner to follow the dashboard where it differs. Whether Mintlify starts in the browser language and builds from `apps/docs` is unverified.
  - No privacy policy page exists in `apps/docs`; Meta's Live mode needs a public URL (meta-setup step 10).
  - `root scripts migrate:production` / `deploy:production` still pass `--env production` on this branch; lanes B and C must drop it.

### Lane B update (owner and coordinator orders, 2026-11-06)

- Preflight refuses Worker and docs deploys while any `COMPANY` field (libs/types, defined here with `COMPANY_FACT_UNSET`) is the sentinel; right after the official number check. Red `693c0c1`, green in the next commit. Tests name each field and assert no command ran.
- Docs preflight also runs `npm view @zapbip/openclaw-plugin@<version> version` after `zapbip@<version>`; the first unresolved package is named. Red/green in the two commits after. The `openclawPluginVersion` input has no caller yet (no docs deploy entry exists); the PyPI package `zapbip-platform` 0.1.0 is a runbook owner step only, the preflight does not check PyPI.
- Runbook owner steps to add in lane D's files: fill the Logic Bit company facts; publish `@zapbip/openclaw-plugin` 0.1.0 to npm; publish `zapbip-platform` 0.1.0 to PyPI.
- `INSTALL_PAGE_PATH_PREFIX` exists on no branch, so the install-route readiness check stays a text match on `/i/:installCode`.

### Lane B update: npm maintainer check (security review of install-skills)

- Production Worker deploys and the docs deploy now run `npm view <package>@<version> maintainers --json` (replacing `... version`); the package must resolve AND its maintainers must include `ZAPBIP_NPM_PUBLISHER` from the owner's environment file (placeholder, empty or missing refuses with no npm command). Docs checks `zapbip` and `@zapbip/openclaw-plugin`; the Worker checks `zapbip@ZAPBIP_NPM_VERSION`, production only. Red `45d02ab`.
- Publishing with two-factor authentication and provenance is an owner runbook step. The maintainers output format (`name <email>` strings) is assumed from npm's documented behaviour, not run against the registry.

### Lane B and D: ops tester fixes (s8-ops, 2026-11-06)

- D1: `inspectWorkerSource` reads only `src/app.ts` and `src/routes/**`; red `3e5bb35`, green `7fcc4e2`. The real-tree test compares the flag with an independent read of the same files, so it stays true after install-skills mounts the route.
- D2: `pnpm docs:preflight` (root script, `apps/api/scripts/docs-preflight.ts`); red `95970f6`, green `87663a2`. It passes `ZAPBIP_NPM_VERSION` for both npm packages (both are 0.1.0).
- D3: `deploy.ts` already forwarded `--first-deploy`; the runbook now uses it and drops the `pending` trick. pnpm forwarding of `pnpm deploy:staging --first-deploy` to the script is not run here (it needs the owner's environment file).
- D4 and D7: official number, company facts and the npm maintainer check apply to production and docs only; staging needs placeholders and secrets. Order is now environment, production gates, placeholders, readiness, smoke inputs, git, secrets, migrations, gate, dry run. Red `6b7d43a`, green `47c69ba`.
- D5, D6, D8, D9 and the missing steps (payment method, number PIN, PyPI commands, buying the domain, the first secret put creating the Worker): runbooks and README order rewritten; the go-live order in `runbooks.test.ts` updated; three new runbook tests are pins.
- D10, E1, E2, E3, E5, E6: smoke output names the failure kind (`ECONNREFUSED`) and never the URL or message; lowercase and hyphenated placeholders are refused; non-JSON wrangler output is refused or reported clearly; an empty version list says "no previous Worker version"; a trailing slash is trimmed from `SMOKE_BASE_URL`; a failed `git fetch` is refused. Red `6b7d43a` and the smoke and rollback red commits; green `47c69ba`, the smoke fix and `66d89f1`.
