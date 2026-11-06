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

- `apps/api/wrangler.jsonc` — top level is production; `env.development` and `env.staging` repeat every binding; plain JSON (no comments, no trailing commas).
- `apps/api/test/unit/wrangler-config.test.ts` — 18 cases: block values, key-set parity per binding class, vars parity, migrations, crons, placeholders.
- `apps/api/test/integration/health.test.ts`, `production-entry.test.ts` (WI-117 now `{ ok: true, environment: 'production' }`; the helper passes `ENVIRONMENT: production`).
- `apps/api/test/e2e/production-bundle.e2e.test.ts` — PB-4, the staging dry-run bundle (pin).
- `docs/features/deploy-readiness/spec.md` — health body amended to `{ ok: true, environment }`.

### How to run

```bash
cd apps/api && pnpm exec vitest run --config vitest.unit.config.mts wrangler-config
cd apps/api && pnpm exec vitest run --config vitest.integration.config.mts health production-entry
cd apps/api && pnpm exec vitest run --config vitest.e2e.config.mts production-bundle
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

### Gaps

- C3 green (health line in `apps/api/src/app.ts`) is blocked: `parseDeployEnvironment` is still the Step 0 stub and no lane's file map owns its body.
- Prettier adds trailing commas to `.jsonc`; the file is plain JSON for the preflight's `JSON.parse`. It needs a `.prettierrc` override (`apps/api/wrangler.jsonc`, `trailingComma: none`) or the `format` gate fails.
- `ratelimits` and `analytics_engine_datasets` parity is not asserted; neither key exists yet.
- The deploy command and runbooks must not use `--env production` (plan A7 and the production-bundle line were stale).
