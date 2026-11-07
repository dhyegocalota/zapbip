# Deploy readiness

**Status:** Building
**Tier:** 🔴
**Owner approval:** approved 2026-11-06 (owner delegated)
**ADRs:** [0026](../../adr/0026-runbooks-live-in-the-repository-not-on-mintlify.md), [0027](../../adr/0027-deploys-run-from-the-owners-machine-not-from-ci.md); builds on [0005](../../adr/0005-the-local-gate-runs-what-the-diff-can-break.md), [0006](../../adr/0006-one-secret-per-connection-in-the-mcp-url.md), [0007](../../adr/0007-a-durable-inbox-and-a-wake-ladder.md), [0009](../../adr/0009-cloudflare-workers-with-one-durable-object-per-account.md), [0010](../../adr/0010-public-docs-on-mintlify.md), [0011](../../adr/0011-the-24-hour-window-queues-and-sends-one-notice.md)
**Not changing:** the domain, use cases, MCP tools and routes that the earlier slices own; no account is created, no deploy runs and no secret value is written by an agent. Only the files listed under Design change.

## Problem

After the first seven slices the product runs against a fake WhatsApp, and a local `wrangler dev`. Going live needs four things the repository does not yet hold:

- deployable configuration for staging and production;
- a deploy that cannot skip a migration or a secret;
- a smoke test that proves a deploy works;
- runbooks for the accounts only the owner can create (Cloudflare, Meta, DNS, Mintlify).

The free-tier design also needs guardrails before traffic arrives: held Durable Object time, the queue expiry and the media retention, none of which run without a scheduled trigger.

## Goals

1. Three environments: `development` (local), `staging` and `production` (deployed), each a complete, separately named set of resources.
2. The owner creates the accounts and runs one documented sequence, `docs/runbooks/README.md`, to go live on the Workers Free plan at `mcp.zapbip.com`.
3. A deploy command that stops when a migration is pending, a secret is missing or production is not a clean `main`.
4. A smoke test that the owner runs after every deploy, and that agents run against `wrangler dev`.
5. Rollback for code and for data, with what each one does not restore written down.
6. Free observability and cost guardrails.
7. The local gate stays the only proof before merge ([ADR 0005](../../adr/0005-the-local-gate-runs-what-the-diff-can-break.md)); CI does not deploy ([ADR 0027](../../adr/0027-deploys-run-from-the-owners-machine-not-from-ci.md)).

## Non-goals

- Creating accounts, logging in, adding a payment method or deploying. The owner does these; agents write the instructions only.
- Paid plans. The Workers Paid plan is the first scaling step ([ADR 0009](../../adr/0009-cloudflare-workers-with-one-durable-object-per-account.md)), not part of this slice.
- Multi-region, backups beyond D1 time travel, load tests.
- Automating Meta business verification, app review or template approval.
- Publishing the runbooks ([ADR 0026](../../adr/0026-runbooks-live-in-the-repository-not-on-mintlify.md)), and any GitHub deploy workflow or deploy token ([ADR 0027](../../adr/0027-deploys-run-from-the-owners-machine-not-from-ci.md)).

## Design

### Environments

| | development | staging | production |
|---|---|---|---|
| Runs as | `wrangler dev`, local D1, R2 and Durable Objects | deployed Worker | deployed Worker |
| Worker name | `zapbip-api-development` | `zapbip-api-staging` | `zapbip-api` |
| Host | `localhost:8787` | `mcp-staging.zapbip.com` | `mcp.zapbip.com` |
| `PUBLIC_ORIGIN` | `http://localhost:8787` | `https://mcp-staging.zapbip.com` | `https://mcp.zapbip.com` |
| `ENVIRONMENT` | `development` | `staging` | `production` |
| D1 database | `zapbip-development` | `zapbip-staging` | `zapbip-production` |
| R2 bucket | `zapbip-media-development` | `zapbip-media-staging` | `zapbip-media-production` |
| Channel | fake WhatsApp | Cloud API, Meta test number | Cloud API, production number |
| Owner simulator (`/dev/*`) | mounted | not mounted | not mounted |
| `WAITLIST_ENABLED` | `false` | `false` | `true` |
| `WHATSAPP_GRAPH_BASE_URL` | the fake's local URL | `https://graph.facebook.com` | `https://graph.facebook.com` |

Development is never deployed, so it costs no resources beyond local emulation.

### Wrangler configuration

One file, `apps/api/wrangler.jsonc`:

- The top-level block is the development configuration that `wrangler dev` reads.
- `env.staging` and `env.production` are the deployed environments.
- Wrangler does not carry bindings or migrations into an environment, so each deployed block declares its own: the Worker name, `d1_databases`, `r2_buckets`, `durable_objects`, `migrations`, `routes`, `vars` and `triggers`.
- Shared settings are repeated per block, not inherited: `main` (`src/index.ts` in the deployed blocks; `src/index.dev.ts` in the development block, the only entry that mounts the simulator), `compatibility_date` (`2026-11-01`), `compatibility_flags: ["nodejs_compat"]`, `observability.enabled: true`, `workers_dev: false`, `preview_urls: false`.

Bindings:

| Binding | Type | Value |
|---|---|---|
| `CONNECTION_DIRECTORY` | D1 | the environment's database; `migrations_dir: "migrations"` |
| `MEDIA_BUCKET` | R2 | the environment's bucket |
| `ACCOUNT_INBOX` | Durable Object | class `AccountInbox` |

Durable Object migrations, one tag per deployed block:

```json
"migrations": [{ "tag": "v1", "new_sqlite_classes": ["AccountInbox"] }]
```

`new_sqlite_classes` is the only form the free plan allows. Later changes add `v2`, `v3`, and never delete or rename a class without a new ADR, because a deleted class takes its inbox with it.

Routes and triggers:

- `routes: [{ "pattern": "mcp.zapbip.com", "custom_domain": true }]` in production, `mcp-staging.zapbip.com` in staging. Wrangler creates the DNS record for a custom domain when the zone is on the same Cloudflare account (`docs/runbooks/dns.md`).
- `triggers.crons`: one cron per block, `["*/30 * * * *"]`, the string of `SCHEDULED_CRON` in `apps/api/src/operations/constants.ts`. A test pins the equality, because wrangler cannot import TypeScript constants. Each tick runs the job registry in `apps/api/src/operations/scheduled.ts`: every tick clears expired install secrets and sweeps deleting accounts; minute 0 runs the budget check; 03:00 UTC runs media retention (owner delegated 2026-11-06).

Resource IDs: `wrangler d1 create` returns a database ID, which the owner pastes into the environment's block. IDs are account identifiers, not secrets, so they are committed. The deploy preflight refuses a placeholder ID.

Vars, non-secret, per block: `ENVIRONMENT`, `PUBLIC_ORIGIN`, `WAITLIST_ENABLED` and `WHATSAPP_GRAPH_BASE_URL` (table above).

### Secrets

Each deployed environment has its own copy, set with `pnpm exec wrangler secret put <NAME> --env <environment>`. The owner types the value at the prompt, or pipes it in (`openssl rand -base64 32 | pnpm exec wrangler secret put <NAME> --env staging`). The value never goes on the command line, so it stays out of shell history and the process list.

| Name | What it is for | Where the owner gets it | Rotation |
|---|---|---|---|
| `META_APP_SECRET` | verifies `X-Hub-Signature-256` on every webhook POST; the smoke test signs its fake inbound with it | Meta app dashboard, Basic settings | change it in Meta, then here, in one sitting; Meta retries failed deliveries |
| `WHATSAPP_ACCESS_TOKEN` | bearer token for every Cloud API call, including media download | system user in Business Settings, a token that does not expire, with the messaging and management permissions | generate a new token, set it, revoke the old one |
| `WHATSAPP_PHONE_NUMBER_ID` | the sending number's ID in the Cloud API path | WhatsApp Manager, API setup | changes only with a new number |
| `WHATSAPP_VERIFY_TOKEN` | answers the webhook subscription challenge | generated by the owner (`openssl rand -hex 24`), entered in Meta too | change both sides together |
| `MEDIA_LINK_SIGNING_KEY` | HMAC key for signed media links (`GET /m/...`) | `openssl rand -base64 32` | rotate; links in flight (1 h) return `403` |
| `UPLOAD_LINK_SIGNING_KEY` | HMAC key for upload URLs (`PUT /c/:secret/u/...`) | `openssl rand -base64 32` | rotate; uploads in progress (15 min) fail once |
| `WAKE_SECRET_KEY` | AES-256-GCM key that seals each connection's wake target (URL and token) for `webhook-wake` | `openssl rand -base64 32` | not rotated in this version: a new key cannot open stored targets, so rotation means setting every wake again. Revisit with `webhook-wake` |

Why these, and not more:

- Connection secrets are stored as SHA-256 hashes ([ADR 0006](../../adr/0006-one-secret-per-connection-in-the-mcp-url.md)), so they need no key.
- `WHATSAPP_PHONE_NUMBER_ID` is a secret even though Meta treats it as an identifier, so the account's number does not sit in the repository.
- Two signing keys, not one: a leaked media key does not let anyone upload, and rotating one does not break the other.

Non-secret inputs for the scripts, in the owner's `.env` only (never deployed): `SMOKE_BASE_URL`, `SMOKE_CONNECTION_SECRET` (the smoke connection of that environment) and `SMOKE_OWNER_PHONE` (a Meta test recipient for staging; the development simulator's fixed owner number for development). The smoke test also reads `META_APP_SECRET` from `.env`.

`.env.example` at the repository root lists every name above with placeholder values only, each starting with `replace-with-`. The owner copies it to `.env` (git-ignored, read by `node --env-file=.env`) for the scripts, and to `apps/api/.dev.vars` (wrangler's own git-ignored file) for `wrangler dev`. Agents never edit `.env*`, and the root `.gitignore` gains `.env` and `.dev.vars` if it does not list them.

The smoke connection is created by the owner on each environment: from WhatsApp with `novo agente smoke` for a deployed environment, and in development through `GET /dev/c/:secret/owner/screen` (accounts-and-keys deletes the development script). Its MCP URL goes into `SMOKE_CONNECTION_SECRET`.

### Deploy command and preflight

Root scripts: `deploy:staging` and `deploy:production` run `apps/api/scripts/deploy.ts --environment <environment>` (`--first-deploy` for the first deploy of an environment), and `docs:preflight` runs `apps/api/scripts/docs-preflight.ts`. The deploy script stops at the first refusal and prints what to do next. Cheap refusals come first and the full gate last. Staging needs only its placeholders, secrets and migrations; the official number, the company facts and npm are production and docs gates (owner delegated 2026-11-06):

1. The environment must be `staging` or `production`, and the terminal must be interactive.
2. Production only: `OFFICIAL_WHATSAPP_NUMBER` is not `OFFICIAL_NUMBER_UNSET`.
3. Production only: no field of `COMPANY` is `COMPANY_FACT_UNSET`.
4. Production only: `zapbip@<ZAPBIP_NPM_VERSION>` and `@zapbip/openclaw-plugin@<OPENCLAW_PLUGIN_NPM_VERSION>` resolve with `npm view <package> maintainers --json` and `npm view <package> _npmUser --json`, and the npm user in `ZAPBIP_NPM_PUBLISHER` is the only maintainer and the publisher of both. A network failure says npm could not be reached; only an `E404` says the package does not resolve. After npm, production and the docs preflight fetch `https://pypi.org/pypi/zapbip-platform/<ZAPBIP_PYPI_VERSION>/json` and refuse unless it answers `200` with `info.maintainer` equal to `ZAPBIP_PYPI_PUBLISHER`; the owner publishes the three packages (npm `zapbip`, npm `@zapbip/openclaw-plugin`, PyPI `zapbip-platform`) before linking Mintlify, because linking publishes the docs on every push to `main` (owner delegated 2026-11-06).
5. Config: the environment's block has no `REPLACE_WITH_` placeholder anywhere, in any letter case.
6. Production only, readiness: the Worker exports `scheduled`, the block has a cron trigger and the built app mounts a `GET` route under `INSTALL_PAGE_PATH_PREFIX`.
7. Smoke inputs: the values the smoke test needs are set in the owner's environment file. With `--first-deploy` the connection inputs are not needed.
8. Git: a clean tree; production also requires branch `main` and `HEAD` equal to `origin/main` after a fetch. A failed fetch is a refusal.
9. Secrets: `wrangler secret list --env <environment> --format json` names every `WorkerSecret`. Output that is not JSON is a refusal.
10. Migrations: `wrangler d1 migrations list <database> --env <environment> --remote` reports nothing to apply.
11. Gate: `pnpm verify all` for production, `pnpm verify` for staging.
12. Dry run: `wrangler deploy --env <environment> --dry-run`.
13. Rollback points: the current Worker version is the version with most traffic in `wrangler deployments status --json`, and the D1 bookmark comes from `wrangler d1 time-travel info <database> --json`. When there is no deployment, the output says there is no previous Worker version and a rollback means redeploying the prior commit.
14. Confirmation: production asks the owner to type `production`. Any other answer stops the deploy.
15. `wrangler deploy --env <environment>`; production passes no `--env`.
16. Smoke test for that environment, with `--first-deploy` forwarded. A failure prints the rollback commands and exits non-zero. The script does not roll back on its own; the owner decides.

Every child process of the script runs with an environment scrubbed of the seven `WorkerSecret` names and the smoke inputs; the smoke script reads the owner's environment file itself. `docs:preflight` refuses while the official number or a company fact is unset, or while either npm package fails the check of step 4; the docs deploy is the merge to `main`, which Mintlify publishes, so the owner runs it before enabling the site.

Migrations run first, always, through `migrate:<environment>` (`pnpm exec wrangler d1 migrations apply <database> --env <environment> --remote`; `--local` for development). Migrations are forward-only and must work with the Worker version still running, so the expand-then-contract rule applies: a column is added in one deploy and its old use removed in a later one. A deploy that fails after its migration leaves the previous Worker serving the new schema.

### Smoke test

`apps/api/scripts/smoke.ts`, run as `pnpm smoke:<environment>` (`node --env-file=.env apps/api/scripts/smoke.ts --environment <environment>`). Each check prints `PASS` or `FAIL`, its status code and its name. The output never includes a secret.

| # | Check | Environments | What it proves |
|---|---|---|---|
| 1 | `health`: `GET /health` returns `200` and `{ "ok": true, "environment": <requested> }` | all | the route reaches the right Worker and environment |
| 2 | `mcp initialize`: JSON-RPC `initialize` then `tools/list` on `/c/<smoke secret>/mcp`; expects the eleven tool names of the MCP contract (agent-inbox-core's ten and `set_wake`) | all | the MCP server and the secret resolve |
| 3 | `webhook verify`: `GET /webhooks/whatsapp` with the verify token and a random challenge returns `200` and the challenge; a wrong token returns `403` | all | the subscription challenge works |
| 4 | `signature rejected`: a webhook POST with a wrong `X-Hub-Signature-256` is refused | all | the signature check is on |
| 5 | `fake inbound`: a text `@smoke <nonce>` from `SMOKE_OWNER_PHONE`, POSTed to the webhook with a correct signature, returns `200`; then `check_inbox` on the smoke connection shows the message with `sender: "owner"` and `verified: true`, polled `SMOKE_POLL_ATTEMPTS` times, `SMOKE_POLL_INTERVAL_MS` apart | development and staging only | the whole inbound path, from signed webhook to an agent's inbox |

Design choices in the smoke test:

- Check 5 uses a fake signed webhook, not the owner simulator, so staging runs the real webhook path. The simulator stays development-only, as `agent-inbox-core` requires.
- The `@smoke ` prefix routes by rule 3 of the routing order, so the check does not depend on open questions or on which agent last wrote.
- The owner's message opens the 24-hour window, so the reply the owner gets back is a session message and bills nothing.
- The script refuses check 5 for `production` in code, not by convention. Production runs checks 1 to 4, which change no state.
- Missing inputs are errors, never defaults.
- The smoke script refuses a base URL that is not `https` (development excepted) or whose host is not the `PUBLIC_ORIGIN` host of the block, before any request carries the connection secret.
- A failed health check stops the run: no later request is sent.
- Check 4 also posts a body signed with the placeholder app secret of the example environment file and expects a refusal, so a placeholder `META_APP_SECRET` in production is caught.
- On `--first-deploy` checks 2 and 5 are skipped and the script prints how to create the smoke connection and run it again.
- A failed request prints its kind (for example `ECONNREFUSED`), never its URL or message.

The smoke connections are owner-created. Their messages stay in staging history; nothing else is cleaned up.

### Observability

- Workers Logs are on (`observability.enabled`). Events carry event names, IDs, kinds and sizes, as `agent-inbox-core` requires; never message text, file names, phone numbers or secrets.
- Live tail: `pnpm exec wrangler tail <worker name> --env <environment> --format pretty`. The runbook gives the command.
- Error-rate alert: a Cloudflare Notifications rule for Worker errors, emailed to the owner, created in the Cloudflare runbook. This is the only alert channel. If the account's plan does not offer it, the runbook says so, and the owner relies on the smoke test and the tail. That gap is recorded as a risk.
- No paid monitoring, no third-party log service.

### Cost guardrails

The free allowances this design relies on, from the [ADR 0009](../../adr/0009-cloudflare-workers-with-one-durable-object-per-account.md) evidence: Durable Objects 100 000 requests and 13 000 GB-s a day; Workers 100 000 requests a day; D1 100 000 rows written and 5 M read a day. R2 and D1 storage limits are checked on Cloudflare's pricing page during setup, not assumed here.

**Durable Object duration budget.** Every MCP request in the Worker records its wall-clock time as GB-seconds (`durationMs / 1000 × DURABLE_OBJECT_MEMORY_GB`, 128 MB = 0.125 GB) into the `usage_meter` table of the account's Durable Object (migration v7), which flushes its total to D1 `usage_daily(day, gb_seconds)` once an hour, so the caller never waits on D1. The budget job, at minute 0 of the `*/30` tick, reads today's total. At `DAILY_BUDGET_WARNING_RATIO` (0.8) of `DURABLE_OBJECT_DAILY_GB_SECONDS` (13 000), it logs `budget.warning` and fails the run, so the error-rate alert emails the owner. The meter approximates Cloudflare's bill, which counts the time an object is active, so the owner checks the real figure on the Durable Objects usage page every week.

**Queue expiry.** No cron fans out over accounts: queue and question expiry are per-object Durable Object alarms from slice 1, so `QUEUE_RETENTION_MS` holds even when the owner never writes again. The `*/30` tick only clears expired install secrets and sweeps deleting accounts, and a failing job fails the run after the other due jobs ran.

**Media retention.** The daily job pages through `MEDIA_BUCKET` and deletes objects uploaded more than `MEDIA_RETENTION_MS` ago. It deletes objects, not history rows: an expired media link returns `404`, and the message text stays in history. An R2 lifecycle rule would also work with no code, but it counts in whole days, while retention is a millisecond constant in `libs/core`. The job keeps one number in one place, so it is chosen.

Constants live in `apps/api/src/operations/constants.ts`, and time conversions use the shared constants in `libs/types`.

### Rollback

| Need | Command | Restores | Does not restore |
|---|---|---|---|
| Bad code or config | `pnpm exec wrangler rollback <version> --env <environment>` (version from the deploy step 9 output) | the Worker's code and its configuration at that version | secrets, D1, R2, Durable Object data |
| Bad directory data | `pnpm exec wrangler d1 time-travel restore <database> --env <environment> --bookmark <bookmark>` (bookmark from deploy step 9) | the connection directory at the bookmark | anything written after it; Durable Object data; R2 objects |
| Bad inbox data | none in this slice | nothing automatic | the inbox lives in Durable Object SQLite, which has no time travel here; the mitigation is that no destructive Durable Object migration is allowed |
| Bad migration | never rolled back by hand | nothing | a new forward migration fixes it |

Rehearsal: before production goes live, the owner deploys a second version to staging, rolls back to the first, runs the smoke test, and deploys again. The runbook records the rehearsal's output.

### Runbooks

All under `docs/runbooks/`, listed in the repository-shape indexes:

- `README.md`: the go-live sequence, in order: Cloudflare setup, DNS, Meta setup, resources and secrets, migrate and deploy staging, smoke staging, rollback rehearsal, Meta templates approved, then production the same way; the Mintlify publish runs any time after DNS.
- `cloudflare-setup.md`: account; Workers Free; R2 enabled (Cloudflare asks for a payment method even within the free allowance); D1 and Durable Objects; a scoped API token exported only in the owner's shell, never `wrangler login`; Workers Logs; the error-rate notification.
- `dns.md`: `zapbip.com` as a zone on Cloudflare (nameservers changed at the registrar); the Worker custom domains; `docs.zapbip.com` as a CNAME to Mintlify; a `dig` check per host.
- `meta-setup.md`: a Business portfolio; a WhatsApp Business account; the production number registered with its SMS or voice code, and the Meta test number for staging; two apps, one for staging and one for production, each with the WhatsApp product and its own number; the webhook `https://<host>/<webhook path>` with the verify token; subscription to `messages` and `message_template_status_update`; the system user token; business verification and Advanced Access requests; the templates from `whatsapp-cloud-channel` submitted in WhatsApp Manager and approved before production.
- `deploy.md`: resources per environment; secrets; `migrate:<environment>`; `deploy:<environment>`; smoke; tail; rollback; the weekly cost check.
- `mintlify-publish.md`: connect the repository, point the docs path at `apps/docs`, set the custom domain, run `mint broken-links` before merging. Publishing happens on merge to `main`.

Each runbook states its purpose in one line, then numbered steps, each with the expected output and an "if it fails" line.

### Data flow

```
owner ── pnpm deploy:<env> ──► preflight (git, gate, secrets, migrations, dry run)
                                  │
                                  ├─ wrangler deploy ──► Cloudflare Worker <env>
                                  └─ smoke.ts ──► /health, /c/<secret>/mcp, webhook ──► Worker <env>

owner ── pnpm migrate:<env> ──► wrangler d1 migrations apply ──► D1 <env>

Cloudflare cron ──► Worker scheduled handler ──► AccountInbox (expire) · R2 (retention) · usage_daily (budget)
Worker MCP request ──► waitUntil ──► usage_daily (GB-seconds)
```

### Interfaces

| Surface | Contract |
|---|---|
| `apps/api/wrangler.jsonc` | three blocks as above; `compatibility_date` `2026-11-01`; the crons equal the constants |
| `apps/api/src/operations/worker-secret.ts` | enum `WorkerSecret` of the seven secret names; the deploy preflight and the `.env.example` test both use it |
| `apps/api/src/operations/constants.ts` | `SCHEDULED_CRON`, `BUDGET_CHECK_MINUTE`, `MEDIA_RETENTION_HOUR`, `MEDIA_RETENTION_MINUTE`, `DURABLE_OBJECT_DAILY_GIGABYTE_SECONDS`, `DURABLE_OBJECT_MEMORY_GIGABYTES`, `DAILY_BUDGET_WARNING_RATIO`, `SMOKE_POLL_ATTEMPTS`, `SMOKE_POLL_INTERVAL_MS` |
| `apps/api/src/routes/health.ts` | `GET /health` → `{ ok: true, environment }`; no database read |
| `apps/api/src/operations/scheduled.ts` | the `scheduled` export: runs the due jobs of the registry for the `*/30 * * * *` tick (install-secret clear, deletion sweep, budget check, media retention) and rejects any other cron |
| `apps/api/scripts/deploy.ts`, `smoke.ts` | `--environment development \| staging \| production`, a `DeployEnvironment` enum; `deploy.ts` takes its shell and its prompt as named parameters so tests replace them |
| root scripts | `deploy:staging`, `deploy:production`, `migrate:development`, `migrate:staging`, `migrate:production`, `smoke:development`, `smoke:staging`, `smoke:production` |
| `apps/api/migrations/` | `0003_usage` (`usage_daily`); `0001_core` and `0002_accounts_and_keys` belong to agent-inbox-core and accounts-and-keys; generated with drizzle-kit |
| `scripts/verify-gates.tsv` | `apps/api/wrangler.jsonc` runs `wrangler deploy --dry-run` for both deployed environments, plus unit tests |

### Failure handling

| Failure | Behaviour |
|---|---|
| A secret is missing on the target environment | the deploy stops at step 5, listing the names |
| A migration is pending | the deploy stops at step 6 and prints the migrate command |
| Production from a dirty tree, another branch or a commit not on `origin/main` | the deploy stops at step 2 |
| A placeholder ID in the environment block | the deploy stops at step 4 |
| The confirmation is not typed | nothing is deployed |
| Smoke fails after deploy | exit non-zero with the rollback commands; the owner decides |
| `/health` names another environment | check 1 fails: the route points at the wrong Worker |
| Wrong `META_APP_SECRET` in the Worker | check 5 fails with `401`/`403`, and real Meta deliveries are refused too |
| Wrong `WHATSAPP_VERIFY_TOKEN` | check 3 fails; Meta's subscription does not confirm |
| A custom domain without DNS | `curl` on the host fails; the DNS runbook's `dig` check shows it before the smoke test |
| A cron run fails for one account | the other accounts run; the run fails at the end; the error alert emails the owner |
| The daily budget reaches 80% | the hourly run logs `budget.warning` and fails, so the owner is emailed |
| A Free-plan CPU limit is hit (10 ms per request) | the request fails with a Worker error; the error alert fires; the smoke test may fail; the fix is the Workers Paid plan, the first scaling step |
| The media object is gone | the signed link returns `404`; the history keeps the message |
| Meta's template send fails outside the window | the message is stored as `delivery: "failed"` ([ADR 0011](../../adr/0011-the-24-hour-window-queues-and-sends-one-notice.md)) |
| A smoke input is missing | an error naming it; the script never defaults a value |

Known risks, for the owner to accept or act on:

1. **Meta business verification and Advanced Access.** Until Meta grants messaging permissions beyond the app's admins and test recipients, other people cannot receive messages. Timing is outside this repository.
2. **Meta conversation charges.** Template notices outside the window are billed per conversation by Meta. The Cloudflare budget does not cover them. The owner checks WhatsApp Manager pricing monthly.
3. **Free-plan CPU limit.** The 10 ms CPU budget per request is the largest unmeasured risk. It is checked on staging by the smoke test and the error alert; the spike measured wall-clock time, not CPU.
4. **R2 needs a payment method.** Cloudflare asks for one before R2 can be enabled, even within the free allowance.
5. **Mintlify and the monorepo.** It is unverified that Mintlify builds from `apps/docs` inside a monorepo. If it cannot, the publish runbook moves ([ADR 0026](../../adr/0026-runbooks-live-in-the-repository-not-on-mintlify.md)).
6. **Notifications availability.** Whether the free plan offers a Workers error-rate notification is unverified. Without it the only alert is the budget failure path, which needs a cron run.
7. **Durable Object data is not restored by time travel.** This is the largest data risk; the mitigations are forward-only migrations and no destructive Durable Object migration.
8. **D1 write quota.** The usage meter adds one D1 write per MCP request. The Durable Object request allowance is the same order of magnitude, so the two limits move together.
9. **Domain ownership.** `zapbip.com` must be a domain the owner controls, with its nameservers moved to Cloudflare.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Where do the runbooks live? | `docs/runbooks/` · Mintlify section · outside the repository | `docs/runbooks/` ([ADR 0026](../../adr/0026-runbooks-live-in-the-repository-not-on-mintlify.md)) | owner delegated 2026-11-06 |
| Who runs deploys, and does CI deploy? | owner's machine · GitHub Actions · Workers Builds | owner's machine, CI runs gates only ([ADR 0027](../../adr/0027-deploys-run-from-the-owners-machine-not-from-ci.md)) | owner delegated 2026-11-06 |
| Which environments are deployed? | development local only · staging + production · three deployed | development local, staging and production deployed | owner delegated 2026-11-06 |
| Hostnames | `mcp.zapbip.com` only · plus staging · plus docs | `mcp.zapbip.com` (production), `mcp-staging.zapbip.com` (staging), `docs.zapbip.com` (Mintlify) | owner delegated 2026-11-06 |
| Meta apps | one app, two numbers · one app per environment | one app per environment: staging with the test number, production with its own number | owner delegated 2026-11-06 |
| Is the phone number ID a secret? | secret · committed variable | secret, so the account's number stays out of git | owner delegated 2026-11-06 |
| Link signing keys | one shared key · one per link kind | one per kind: `MEDIA_LINK_SIGNING_KEY`, `UPLOAD_LINK_SIGNING_KEY` | owner delegated 2026-11-06 |
| Rotate the wake secret key (`WAKE_SECRET_KEY`)? | rotate with re-encryption · no rotation in v1 | no rotation in v1; revisit with `webhook-wake` | owner delegated 2026-11-06 |
| Media retention mechanism | scheduled job · R2 lifecycle rule | scheduled job, as the owner asked, sharing one millisecond constant with `libs/core` | owner delegated 2026-11-06 |
| Durable Object budget alert | Cloudflare analytics polling · self-metered counter with failing run | self-metered counter; the failing run feeds the error-rate alert | owner delegated 2026-11-06 |
| Staging fake inbound | owner simulator · signed webhook | signed webhook, so the real path is tested; the simulator stays development-only | owner delegated 2026-11-06 |
| Production smoke | full · read-only | checks 1 to 4 only; no state changes | owner delegated 2026-11-06 |
| Rollback | code only · code and data | code by `wrangler rollback`; directory data by D1 time travel; inbox data has no restore in this slice | owner delegated 2026-11-06 |
| Observability | Workers Logs and tail · a third-party log service | Workers Logs and tail; error-rate alert from Cloudflare | owner delegated 2026-11-06 |
| Migration numbers | one per slice · by what holds D1 data | `0001_core`, `0002_accounts_and_keys`, `0003_usage`; wake and scheduled state live in the Durable Object and add none | owner delegated 2026-11-06 |
| Waitlist in staging | true · false | `false` in staging, so smoke check 5 creates an active account; `true` in production only | owner delegated 2026-11-06 |
| Smoke connection | development script · WhatsApp `novo agente` | WhatsApp `novo agente smoke` on deployed environments, the simulator in development | owner delegated 2026-11-06 |
| Agent deploy guard and Cloudflare credentials (cross-slice) | text scan with exemptions · strict allowlist with an enforced credential control | `guard-deploy.sh` allows only anchored wrangler forms and `git commit -F` / `git log` when the command names wrangler, a production script or the deploy and smoke scripts; `guard-secrets.sh` blocks any command that names a dotenv file except a plain read or echo/printf prose; the hook checks, on every call, for a wrangler config file, a Cloudflare or CF API token or key in the environment or in a repository dotenv file and then refuses every wrangler command but `whoami`, `--version` and `logout`; the owner deploys with a scoped `CLOUDFLARE_API_TOKEN` and never `wrangler login` ([ADR 0027](../../adr/0027-deploys-run-from-the-owners-machine-not-from-ci.md)) | owner delegated 2026-11-06 |
| Health body | `{ status: "ok", environment }` · `{ ok: true, environment }` | `{ ok: true, environment }`, matching slice 1's `ok` key | owner delegated 2026-11-06 |

## Test strategy summary

- **Unit (Vitest, no network):**
  - `wrangler.jsonc` shape: three blocks with distinct names, bindings, routes and migration tags; the crons equal the constants; the development block mounts the simulator and the deployed blocks do not;
  - `.env.example`: its names equal the `WorkerSecret` enum plus the smoke inputs, and every value starts with `replace-with-`;
  - the deploy preflight, with a fake shell: each refusal in steps 1 to 7 and the confirmation, with the exact message;
  - the smoke script, with a fake `fetch`: each check passes and fails as specified, production refuses check 5, and output never contains a secret value;
  - the usage meter's GB-second arithmetic and the 80% threshold;
  - the scheduled dispatch: queue expiry across accounts with one failing, media retention paging, and the budget failure.
- **Workers integration (`@cloudflare/vitest-pool-workers`, real workerd, D1, R2, Durable Objects):** `/health` names the configured environment; the `scheduled` handler runs each cron against seeded data; the simulator is absent when `ENVIRONMENT` is `staging`.
- **Local end to end, no Cloudflare account:** `wrangler dev` with `apps/api/.dev.vars`, then `pnpm smoke:development`. All five checks run against localhost, and that is the proof agents can give before the owner's accounts exist.
- **Gate:** `wrangler deploy --dry-run` for staging and production runs in `pnpm verify` when `apps/api/wrangler.jsonc` changes.
- **Repository shape:** every runbook is in the index and every link resolves.
- **Owner-run, recorded in the runbooks, never run by agents:** staging deploy, migrate, smoke, rollback rehearsal; then production the same. The owner's output is pasted into the go-live note.
