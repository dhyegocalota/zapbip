# Test plan: Deploy readiness

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts). Areas are grouped so separate tester sub-agents can run them in parallel: Config, Environment and secrets, Deploy preflight, Smoke, Usage and jobs, Worker integration, Runbooks, End to end (default gate), Security, Production bundle, Owner-run.

## The failing test first

- [ ] `apps/api/test/unit/wrangler-config.test.ts::pins the three wrangler environments` — input: `apps/api/wrangler.jsonc` as slice 1 leaves it; expected: fails because there is no `env.staging` key.
- [ ] `apps/api/test/unit/deploy-preflight.test.ts::refuses each step with its message` — input: one fake shell per step, failing that step; expected: the first failing step's message is returned and no later step runs.
- [ ] `apps/api/test/unit/usage-meter.test.ts::gigabyte seconds for a duration` — input: `durationMs: 2000`; expected: `0.25`.
- [ ] `apps/api/test/unit/scheduled.test.ts::cron to job mapping` — input: `BUDGET_CHECK_CRON`; expected: budget check runs and retention does not.
- [ ] `apps/api/test/integration/health.test.ts::names the configured environment` — input: `ENVIRONMENT: 'staging'`; expected: `200` and body `{ "ok": true, "environment": "staging" }`.
- [ ] Each failure is the missing feature, not a broken test: `tester-briefing.md` records the first failing assertion of each red run.

## Config (unit)

Source: `apps/api/test/unit/wrangler-config.test.ts`, reads `apps/api/wrangler.jsonc` with `JSON.parse`.

- [ ] Edge: the file parses — input: the committed `wrangler.jsonc`; expected: no exception (no comment, no trailing comma).
- [ ] Top-level block — input: top-level object; expected: `main` is `src/index.dev.ts`, D1 `zapbip-development`, R2 `zapbip-media-development`, `vars.ENVIRONMENT` `development`, `vars.PUBLIC_ORIGIN` `http://localhost:8787`.
- [ ] Staging block — input: `env.staging`; expected: `name` `zapbip-api-staging`, `main` `src/index.ts`, D1 `zapbip-staging`, R2 `zapbip-media-staging`, `vars.PUBLIC_ORIGIN` `https://mcp-staging.zapbip.com`, `vars.WAITLIST_ENABLED` `"false"`, `vars.WHATSAPP_GRAPH_BASE_URL` `https://graph.facebook.com`.
- [ ] Production block — input: `env.production`; expected: `name` `zapbip-api`, D1 `zapbip-production`, R2 `zapbip-media-production`, `routes` `[{ "pattern": "mcp.zapbip.com", "custom_domain": true }]`, `vars.PUBLIC_ORIGIN` `https://mcp.zapbip.com`, `vars.WAITLIST_ENABLED` `"true"`.
- [ ] Parity of binding keys — input: the set of keys under `d1_databases`, `r2_buckets`, `durable_objects.bindings`, `ratelimits`, `analytics_engine_datasets`, `rules` in each block; expected: identical key sets across the three blocks, for every binding class that the top-level block declares.
- [ ] Parity of vars — input: `vars` keys of each block; expected: identical key sets (`ENVIRONMENT`, `PUBLIC_ORIGIN`, `WAITLIST_ENABLED`, `WHATSAPP_GRAPH_BASE_URL`, plus any slice adds).
- [ ] Forbidden var — input: any block's `vars`; expected: no key named `PUBLIC_BASE_URL`.
- [ ] Migrations per block — input: each block's `migrations`; expected: `[{ "tag": "v1", "new_sqlite_classes": ["AccountInbox"] }]`.
- [ ] Crons — input: each block's `triggers.crons`; expected: `["0 * * * *", "5 0 * * *"]`, equal to `BUDGET_CHECK_CRON` and `MEDIA_RETENTION_CRON`.
- [ ] No hourly fan-out — input: the cron list; expected: exactly two crons, and neither is a per-account job (no test imports `QUEUE_EXPIRY_CRON`).
- [ ] Simulator mounting — input: `main` of each block; expected: the development block is `src/index.dev.ts`; the deployed blocks are `src/index.ts`, which never imports the simulator.
- [ ] Placeholder IDs — input: `database_id` and `bucket_name` of staging and production; expected: each starts with `replace-with-`, and the test lists the four keys.

## Environment and secrets (unit)

Source: `apps/api/test/unit/env-example.test.ts`, `root-scripts.test.ts`.

- [ ] `.env.example` names — input: the keys of the file; expected: exactly the seven `WorkerSecret` values plus `SMOKE_BASE_URL`, `SMOKE_CONNECTION_SECRET`, `SMOKE_OWNER_PHONE`.
- [ ] `.env.example` values — input: every value; expected: each starts with `replace-with-`, none empty.
- [ ] `.gitignore` — input: root `.gitignore`; expected: lists `.dev.vars` and `.env`; `.env.example` is not ignored.
- [ ] Root scripts — input: root `package.json`; expected: the eight scripts of the contract are present.
- [ ] Database names — input: the `d1 migrations apply <database>` names in `migrate:*` and each block's `database_name`; expected: equal per environment.
- [ ] Environment flags — input: each `deploy:*` and `smoke:*` script; expected: the `--environment` value equals the script suffix.
- [ ] `tsx` pin — input: root `devDependencies.tsx`; expected: exactly `4.23.15`.

## Deploy preflight (unit)

Source: `deploy-preflight.test.ts`, `deploy-entry.test.ts`. A fake `DeployShell` records each command and returns scripted results; a fake `DeployPrompt` returns a scripted answer.

- [ ] Step 1 environment — input: `development`; expected: refused, message names `staging` or `production`, no command recorded.
- [ ] Step 1 terminal — input: `production`, `isInteractive: false`; expected: refused with the non-interactive message; no command.
- [ ] Step 2 production branch — input: branch `feat/x`, clean, `HEAD` equal to `origin/main`; expected: refused at step 2 with the branch message.
- [ ] Step 2 dirty tree — input: `git status --porcelain` prints one line, production; expected: refused at step 2 with the dirty-tree message.
- [ ] Step 2 HEAD not on origin — input: branch `main`, clean, `HEAD` differs from `origin/main` after fetch; expected: refused at step 2; `git fetch origin main` recorded before the comparison.
- [ ] Step 2 staging — input: staging, clean, branch `feat/x`; expected: step 2 passes.
- [ ] Step 2 staging dirty — input: staging, one changed file; expected: refused at step 2 with the dirty-tree message.
- [ ] Step 3 gate production — input: gate fails; expected: refused at step 3; recorded command `pnpm verify all`.
- [ ] Step 3 gate staging — input: gate passes; expected: recorded command `pnpm verify`.
- [ ] Step 4 placeholder database — input: staging `database_id` `replace-with-d1-id`; expected: refused at step 4 naming `database_id`.
- [ ] Step 4 placeholder bucket — input: production `bucket_name` `replace-with-bucket`; expected: refused naming `bucket_name`.
- [ ] Step 4 real IDs — input: a 36-character ID; expected: passes.
- [ ] Step 5 missing secret — input: `secret list` JSON without `WAKE_SECRET_KEY`; expected: refused, message lists `WAKE_SECRET_KEY` only.
- [ ] Step 5 all present — input: all seven names; expected: passes.
- [ ] Step 5 command — input: staging; expected: `pnpm --filter @zapbip/api exec wrangler secret list --env staging --format json`.
- [ ] Step 6 pending migration — input: `d1 migrations list` prints a pending `0003_usage.sql`; expected: refused, message contains `pnpm migrate:staging`; no `deploy` command recorded.
- [ ] Step 6 none pending — input: `No migrations to apply!`; expected: passes.
- [ ] Step 7 smoke input missing — input: `SMOKE_OWNER_PHONE` absent; expected: refused naming `SMOKE_OWNER_PHONE` before the dry run.
- [ ] Step 7 smoke input placeholder — input: `SMOKE_CONNECTION_SECRET` `replace-with-x`; expected: refused naming `SMOKE_CONNECTION_SECRET`.
- [ ] Step 8 dry run first — input: all pass; expected: `wrangler deploy --env staging --dry-run` recorded before any real deploy.
- [ ] Step 8 dry-run failure — input: dry run exits `1`; expected: refused at step 8; no deploy recorded.
- [ ] Step 9 rollback points — input: all pass; expected: output contains the first entry of `wrangler versions list --env <environment>` and the `wrangler d1 time-travel info` line.
- [ ] Step 10 confirmation — input: production, answer `production`; expected: step 11 runs.
- [ ] Step 10 wrong answers — input: production, answers `Production`, `production `, `prod`, empty; expected: for each, nothing deployed, message says the deploy was not confirmed.
- [ ] Step 10 staging — input: staging; expected: the prompt is never asked.
- [ ] Step 11 deploy — input: staging, all pass; expected: last recorded command `pnpm --filter @zapbip/api exec wrangler deploy --env staging`.
- [ ] Step 12 smoke failure — input: deploy succeeds, smoke exits `1`; expected: output prints the rollback commands with the step 9 versions; script exits non-zero; no rollback command is run by the script.
- [ ] Order — input: all pass; expected: recorded commands in order: git checks, gate, secret list, migrations list, dry run, deploy, smoke.
- [ ] Edge: unknown environment — input: `parseDeployEnvironment({ value: 'preview' })`; expected: throws.
- [ ] Edge: `undefined` — input: `parseDeployEnvironment({ value: undefined })`; expected: throws.

## Smoke (unit)

Source: `smoke-checks.test.ts`, `smoke-inputs.test.ts`, `signed-webhook.test.ts`, `terminal-shell.test.ts`. A fake `SmokeFetch` answers by method and path.

- [ ] Check 1 health pass — input: `GET /health` returns `200` `{ "ok": true, "environment": "staging" }`, requested `staging`; expected: `PASS 200 health`.
- [ ] Check 1 wrong environment — input: body names `production`, requested `staging`; expected: `FAIL 200 health`.
- [ ] Check 1 wrong status — input: `500`; expected: `FAIL 500 health`.
- [ ] Check 2 eleven tools — input: `tools/list` returns the eleven registry names; expected: `PASS 200 mcp initialize`.
- [ ] Check 2 missing tool — input: `tools/list` returns ten names; expected: `FAIL 200 mcp initialize` with the missing name in the detail.
- [ ] Check 2 path — input: `SMOKE_CONNECTION_SECRET`; expected: the secret appears only in the request path `/c/<secret>/mcp` and never in output.
- [ ] Check 3 pass — input: `GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<random>`; fake answers `200` with the challenge; expected: `PASS 200 webhook verify`.
- [ ] Check 3 wrong token — input: a challenge with a wrong verify token; fake answers `403`; expected: `PASS 403 webhook verify` (refusal is the expected outcome). If the fake answers `200`, expected: `FAIL 200 webhook verify`.
- [ ] Check 3 challenge — input: two runs; expected: the challenge differs between runs.
- [ ] Check 4 refused — input: POST with `X-Hub-Signature-256: sha256=` and 64 zeros; fake answers `401`; expected: `PASS 401 signature rejected`.
- [ ] Check 4 accepted — input: fake answers `200` to the bad signature; expected: `FAIL 200 signature rejected`.
- [ ] Check 5 pass — input: signed text `@smoke <nonce>` from `SMOKE_OWNER_PHONE`; fake answers `200` to the webhook, and `check_inbox` shows the message with `sender: "owner"` and `verified: true` on the first poll; expected: `PASS 200 fake inbound`.
- [ ] Check 5 polling — input: the message appears on the third poll; expected: three `check_inbox` calls spaced by `SMOKE_POLL_INTERVAL_MS`; `PASS`.
- [ ] Check 5 never appears — input: no message in `SMOKE_POLL_ATTEMPTS` polls; expected: `FAIL 200 fake inbound` with the attempt count in the detail.
- [ ] Check 5 signature — input: the body bytes and `META_APP_SECRET`; expected: header equals `sha256=` plus lowercase hex HMAC-SHA-256 of the exact bytes sent.
- [ ] Signed payload shape — input: `buildSignedWebhookPost({ appSecret, ownerWaId: '5511999990000', phoneNumberId: 'PNID', text: '@smoke n1', nonce: 'n1', timestamp: '1762387200' })`; expected: parsed body has `object` `whatsapp_business_account`, `entry[0].changes[0].field` `messages`, `value.metadata.phone_number_id` `PNID`, `value.messages[0].from` `5511999990000`, `value.messages[0].type` `text`, `value.messages[0].text.body` `@smoke n1`, `value.messages[0].id` `wamid.n1`.
- [ ] Check 5 production refused in code — input: `environment: 'production'`; expected: exactly the results of checks 1 to 4; no POST with a body containing `@smoke`; no `fake inbound` line.
- [ ] Check 5 through the entry — input: `--environment production` with a fake fetch; expected: four results, exit `0` when they pass.
- [ ] Output format — input: any run; expected: each line matches `^(PASS|FAIL) \d{3} .+$`, one line per check.
- [ ] Output never contains a secret — input: `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `SMOKE_CONNECTION_SECRET` set to distinctive values, all checks run; expected: none of the three appears in stdout or stderr.
- [ ] Exit code failure — input: check 2 fails; expected: exit `1`.
- [ ] Exit code pass — input: all pass; expected: exit `0`.
- [ ] Missing input — input: `SMOKE_BASE_URL` unset; expected: error naming it, no request sent.
- [ ] Empty input — input: `SMOKE_OWNER_PHONE=""`; expected: error naming it.
- [ ] Placeholder input — input: `SMOKE_CONNECTION_SECRET=replace-with-secret`; expected: error naming it.
- [ ] Missing `META_APP_SECRET` with check 5 — input: unset; expected: error naming it; no default secret is used.
- [ ] Terminal shell arguments — input: `secret put META_APP_SECRET --env staging`; expected: arguments equal `['wrangler', 'secret', 'put', 'META_APP_SECRET', '--env', 'staging']`, no `shell: true`.
- [ ] Terminal shell stdin — input: the same call with a value; expected: the value is written to the child's stdin and is absent from the arguments.

## Usage and jobs (unit and integration)

Source: `usage-meter.test.ts`, `scheduled.test.ts`, `media-retention.test.ts`, `usage-repository.test.ts`, `usage-in-object.test.ts`, `usage-security.test.ts`, `scheduled.test.ts` (integration).

- [ ] Arithmetic — input: `durationMs: 1000`; expected: `0.125`.
- [ ] Arithmetic zero — input: `durationMs: 0`; expected: `0`.
- [ ] Arithmetic large — input: `durationMs: 50000`; expected: `6.25`.
- [ ] Negative duration — input: `durationMs: -1`; expected: throws, nothing reported.
- [ ] Threshold below — input: `gigabyteSeconds: 10399.99`; expected: `isBudgetWarning` is `false`.
- [ ] Threshold at 80 percent — input: `gigabyteSeconds: 10400`; expected: `true` (13 000 × 0.8).
- [ ] Threshold above — input: `gigabyteSeconds: 13001`; expected: `true`.
- [ ] Day key — input: `now` = `Date.UTC(2026, 10, 6, 23, 59)`; expected: `2026-11-06`.
- [ ] Day key midnight — input: `now` = one millisecond after `Date.UTC(2026, 10, 7)`; expected: `2026-11-07`.
- [ ] Object meter accumulates a resolved call — input: an MCP `tools/list` for a resolved connection through `SELF.fetch`; expected: the object's day total in its SQLite is greater than `0`, the alarm is armed at `usageFlushDueAt`, and `usage_daily` is still empty (no D1 write yet).
- [ ] Object meter flushes absolute totals — input: two resolved calls on one day, then the test clock moves one hour past the due time and the alarm fires; expected: exactly one row for the account and day, whose `gigabyte_seconds` equals the object's day total.
- [ ] Repository read on an empty day — input: `readDayTotal` for a day with no rows; expected: `0`.
- [ ] Repository sums accounts — input: two accounts reported for one day with `1.5` and `2.5`; expected: `readDayTotal` returns `4`.
- [ ] Repository other day — input: a row for another day; expected: not included in the total.
- [ ] Write budget per hour (U-HOUR) — input: 1,000 resolved MCP calls to one account within one hour, with a D1 wrapper counting `usage_daily` upserts; expected: at most `1` upsert in that hour; after moving the clock one hour and firing the alarm, exactly `1` more upsert, and the stored value equals the object's day total.
- [ ] Flush uses the alarm only — input: 1,000 resolved calls; expected: zero upserts issued by the request path itself (the count is taken before the alarm fires).
- [ ] Budget lag tolerated — input: `usage_daily` holds a total flushed 59 minutes ago that is below threshold while the object holds a total above it; expected: the budget check reads only the D1 total and does not warn; after the next flush one hour later, it warns.
- [ ] Alarm arming registry — input: a resolved call with another provider due earlier than `usageFlushDueAt`; expected: the alarm is re-armed to the earlier due time, and the flush still runs at its own due time.
- [ ] Budget warns at threshold — input: `readDayTotal` returns `10400`; expected: `budget.warning` logged with the day and the total; the run throws.
- [ ] Budget under threshold — input: `10000`; expected: no `budget.warning` line; no throw.
- [ ] Budget reads one value — input: the budget check; expected: exactly one `readDayTotal` call and no account listing.
- [ ] Retention boundary — input: objects uploaded at `now - MEDIA_RETENTION_MS - 1` and `now - MEDIA_RETENTION_MS`; expected: the first is deleted, the second kept.
- [ ] Retention paging — input: 1,001 objects, page size 1,000, all old; expected: all 1,001 deleted; the second page requested with the first page's `cursor`.
- [ ] Retention mixed — input: 1,001 objects, every second one old; expected: exactly the old ones deleted.
- [ ] Retention absent key — input: `delete` for a key already gone; expected: no exception; the run continues.
- [ ] Retention lists R2 only — input: the daily cron; expected: no D1 or Durable Object call is made.
- [ ] Cron dispatch — input: `BUDGET_CHECK_CRON`; expected: budget check only. `MEDIA_RETENTION_CRON`; expected: retention only.
- [ ] Unknown cron — input: `*/5 * * * *`; expected: throws naming the cron; no job runs.
- [ ] Budget and retention independent — input: the budget check throws; expected: the retention cron still runs when triggered on its own, and the two share no state.
- [ ] Edge: flush failure — input: the D1 upsert rejects at the hour's flush; expected: the MCP response is unaffected, the due time is kept, the next alarm retries, and the failure is logged with the account id and no message text.

## Worker integration

Source: `apps/api/test/integration/*.test.ts`, under `@cloudflare/vitest-pool-workers`, bound to the development block.

- [ ] `GET /health` on development — input: `ENVIRONMENT` from the development block; expected: `200` `{ "ok": true, "environment": "development" }`.
- [ ] `GET /health` unknown environment — input: `ENVIRONMENT: 'preview'`; expected: Worker error (500); the body names no secret.
- [ ] Simulator absent on staging — input: `createApp({ includeSimulator: false })` with `ENVIRONMENT: 'staging'`; expected: `GET /dev/owner/<phone>/screen` returns `404`.
- [ ] Migrations applied — input: the pool applies `migrations/`; expected: `usage_daily` exists with `day`, `account_id`, `gigabyte_seconds`.
- [ ] Scheduled export wired — input: `default.scheduled` with `cron: '0 * * * *'`; expected: resolves; with an unknown cron, rejects.
- [ ] Budget against seeded data — input: seeded `usage_daily` rows for today totalling `10400`; expected: the hourly cron logs `budget.warning` and rejects.
- [ ] Retention against R2 — input: one R2 object older than retention and one newer, `now` moved past retention for the first; expected: the old object is gone, the new one remains.
- [ ] Deploy dry run staging — input: `wrangler deploy --dry-run --env staging --outdir <scratch>`; expected: exit `0`; the bundle lacks `/dev/owner/`.
- [ ] Deploy dry run production — input: `--env production`; expected: exit `0`; the bundle lacks `DevOwnerSimulator` and the fake Graph harness.
- [ ] Edge: dry run with placeholder IDs — input: the committed file; expected: the test records the exit status wrangler actually returns, and the box is ticked only with that output as evidence (A19).

## Security checks

- [ ] Unknown secret is not counted — input: a request to `/c/<unknown>/mcp`; expected: `401`; the object's day total and its alarm are unchanged; no `usage_daily` write; the object's RPC is never called (asserted with a stub that throws on use).
- [ ] Revoked secret is not counted — input: a revoked connection's secret; expected: `401`; no usage row change.
- [ ] Malformed secret is not counted — input: `/c/not-a-secret/mcp`; expected: `401`; no usage row change.
- [ ] Deploy refuses production on a branch — input: production, branch `feat/x`; expected: refused at step 2; no command after it.
- [ ] Secret not in argv — input: `runDeploy` with a secret value in the environment; expected: no recorded argument equals or contains the value.
- [ ] Secret not in output — input: a deploy where wrangler prints the secret name only; expected: captured output contains the name and not the value.
- [ ] Smoke connection secret only in paths — input: a smoke run; expected: `SMOKE_CONNECTION_SECRET` appears only in MCP request paths, never in output or logs.
- [ ] Production never receives a smoke inbound — input: `--environment production` with a fake fetch recording every POST; expected: zero POSTs whose body contains `@smoke`.
- [ ] Missing smoke input stops before any request — input: `SMOKE_CONNECTION_SECRET` unset; expected: zero fake fetch calls.
- [ ] Wrong signature refused — input: webhook POST with a signature of 64 zeros; expected: `401`; nothing stored.
- [ ] Placeholder deploy target — input: staging with `replace-with-` database ID; expected: refused at step 4 before any command that touches the account.
- [ ] Usage meter never blocks — input: `reportDay` rejects; expected: `200` returned to the caller, failure logged.
- [ ] Key name — input: `grep -rn MEDIA_LINK_SECRET apps/api`; expected: no match (after Step R1 applies).
- [ ] No env files written — input: a full unit and integration run; expected: `git status --porcelain` shows no new env or `.dev.vars` file.

## Runbooks (repository shape)

Source: `tools/repository-shape/src/runbooks.test.ts`.

- [ ] Index lists every runbook — input: files in `docs/runbooks/` other than `README.md`; expected: each linked from `README.md` exactly once.
- [ ] Links resolve — input: every relative link in the runbooks; expected: each target exists.
- [ ] Purpose line — input: each runbook; expected: one sentence after the title.
- [ ] Numbered steps — input: each runbook; expected: numbered `1.`, `2.`, … without gaps.
- [ ] Failure line per step — input: each step; expected: followed by an `If it fails` line.
- [ ] Immutable-migration rule — input: `deploy.md`; expected: contains the rule that a deployed migration is never edited.
- [ ] Not on Mintlify — input: `apps/docs/` files; expected: none links to `docs/runbooks`.
- [ ] Go-live order — input: numbered headings of `README.md`; expected: Cloudflare setup, DNS, Meta setup, resources and secrets, migrate and deploy staging, smoke staging, rollback rehearsal, Meta templates approved, production; Mintlify publish after DNS.
- [ ] Commands match — input: every `pnpm <script>` in the runbooks; expected: each is a root script.
- [ ] Edge: empty runbook — input: a temporary copy with a title only; expected: the test fails naming the file.

## End to end (default gate)

Runs in `pnpm verify` by default. It starts the fake Graph harness, `wrangler dev --env development` on free ports, and passes fake secrets with `--var`. It writes no env file.

- [ ] Owner flow — input: the simulator sends `novo agente smoke` from the owner phone through `POST /dev/owner/:phone/messages`; expected: the reply on `GET /dev/owner/:phone/screen` carries the MCP URL, and the connection exists.
- [ ] Smoke development — input: `smoke.ts --environment development` with that secret; expected: five `PASS` lines; exit `0`.
- [ ] Check 5 end to end — input: the same run; expected: the `@smoke` text is in the smoke connection's inbox with `sender: "owner"`, `verified: true`.
- [ ] Fake Graph used — input: the owner reply; expected: the fake Graph recorded one send matching a recorded fixture, and no request reached `graph.facebook.com`.
- [ ] Wrong META_APP_SECRET — input: the Worker secret differs from the smoke's; expected: check 5 fails with `401` or `403`; exit `1`.
- [ ] Wrong verify token — input: the Worker's `WHATSAPP_VERIFY_TOKEN` differs; expected: check 3 fails with the status the Worker returns; output names no secret.
- [ ] Health names development — input: `GET /health` on the local port; expected: `environment` `development`.
- [ ] Console clean — input: `wrangler dev` output during the run; expected: no `Error` line other than the deliberate `401` (check 4) and the refused verify token.
- [ ] Gate runs without a flag — input: `pnpm verify` with no environment variable set; expected: the `e2e` gate runs, not skipped.
- [ ] Port failure is loud — input: a busy port forced in the test; expected: the test fails naming the port, not a skip.

## Production bundle

- [ ] Production excludes the simulator — input: `wrangler deploy --dry-run --env production` (agent-inbox-core's bundle test, now with `--env production`); expected: no `/dev/owner/` and no `DevOwnerSimulator`.
- [ ] Production excludes the fake Graph — input: the same bundle; expected: no fake Graph harness module and no fixture path.
- [ ] Production requires the Graph URL — input: production with `WHATSAPP_GRAPH_BASE_URL` unset; expected: the Worker refuses to start its channel (slice 2's rule), not a default.
- [ ] Development includes the simulator — input: `wrangler dev` on the development block; expected: `/dev/owner/<phone>/screen` answers `200`.

## Owner-run (outside the gate, never run by agents)

Each box is ticked by the owner with the output pasted into the go-live note.

- [ ] Cloudflare account, Workers Free, R2 enabled, D1 and Durable Objects created — input: `cloudflare-setup.md`; expected: the three resources appear in the dashboard.
- [ ] `zapbip.com` on Cloudflare — input: `dns.md`; expected: `dig` returns the Cloudflare nameservers.
- [ ] Meta apps, numbers and templates — input: `meta-setup.md`; expected: the webhook verifies with `WHATSAPP_VERIFY_TOKEN`; templates `APPROVED` before production.
- [ ] Secrets on staging — input: `wrangler secret put <NAME> --env staging` for the seven names; expected: `wrangler secret list --env staging` names all seven.
- [ ] Staging migrate, deploy, smoke — input: `pnpm migrate:staging`, `pnpm deploy:staging`, `pnpm smoke:staging`; expected: migration applied, deploy completes, five `PASS` lines.
- [ ] Rollback rehearsal on staging — input: deploy a second version, roll back to the first, smoke, deploy again; expected: smoke passes after each step; output in the runbook.
- [ ] Production migrate, deploy, smoke — input: `pnpm migrate:production`, `pnpm deploy:production`, typing `production`, `pnpm smoke:production`; expected: four `PASS` lines (checks 1 to 4).
- [ ] Error-rate notification — input: `cloudflare-setup.md`; expected: a test notification arrives, or the runbook records the plan does not offer it.
- [ ] Weekly cost check — input: the Durable Objects usage page and `usage_daily`; expected: both recorded in the go-live note, below `DAILY_BUDGET_WARNING_RATIO` of the allowance.

## Edge cases found during execution

Empty on purpose. The tester adds one checkbox per new case (input, exact expected outcome) and a regression test for each.

## Adversarial review

- [ ] Claim 1: the hourly budget check cannot skip an account, because it reads one D1 total and never lists accounts — attack: insert a usage row for an account with no inbox; result: `held` or `refuted`.
- [ ] Claim 2: the deploy preflight refuses every production run whose `HEAD` differs from `origin/main` — attack: a `HEAD` one commit ahead of `origin/main`; result: `held` or `refuted`.
- [ ] Claim 3: no unresolved request reaches the usage meter — attack: a valid-looking but unknown secret that hashes to a real row's prefix; result: `held` or `refuted`.

## Coverage honesty

- Real Cloudflare behaviour (routes creating DNS, custom domains, R2 and D1 storage pricing, the Durable Object bill) — no account is created by agents (spec non-goal); the owner-run section and the weekly cost check carry the risk. The meter approximates the bill (spec).
- The Workers Free CPU limit (10 ms per request) — not measurable locally; checked by the smoke test and the error alert on staging (spec risk 3).
- Whether the free plan offers a Workers error-rate notification — unverified; the runbook says what to do if not (spec risk 6).
- `wrangler deploy --dry-run` needing a Cloudflare login — assumed not (A19); if it does, the dry-run boxes are recorded `not run`.
- Dry runs with placeholder IDs — wrangler's behaviour is unverified; the edge box records the actual output.
- Mintlify building from `apps/docs` in the monorepo — no Mintlify page is added here; the publish runbook is checked for links only (spec risk 5).
- Meta business verification, Advanced Access and template approval — outside the repository (spec non-goal).
- D1 writes for usage: at most one per account per hour (test U-HOUR), so traffic cannot spend the daily write allowance (spec risk 8). The budget may lag real usage by up to one hour (A10); it is a warning at 80 percent, not a hard stop.
- A failed flush is retried at the next alarm; until then the budget shows the previous total (A10). No test measures real Cloudflare alarm timing.
- Real Meta delivery is not exercised by the default gate; the fake Graph and signed payloads cover the path, and the owner-run staging smoke covers the real one.
