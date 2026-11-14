# 0063. An agent may deploy when the command names the environment

- Status: Accepted
- Date: 2026-11-14
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [ADR 0027](0027-deploys-run-from-the-owners-machine-not-from-ci.md), whose points 2 and 4 this replaces; the owner's words of 2026-11-14: remove the deploy guard and correct the script so the deploy can run

## Context

ADR 0027 made a production deploy the owner's act alone: the script needed an interactive terminal and the owner typing `production`, and a hook blocked every agent command that named `wrangler`, a deploy script or a production package script. The owner now runs the work through agents end to end and wants them to deploy.

## Decision

1. `deploy.ts` takes `--confirm <environment>`. When it names the environment being deployed, the production question is not asked and no terminal is needed; any other value, or none, keeps the old rule (a terminal and the typed word). The preflight, the dry run, the secrets check, the migrations check and the smoke test still run and still stop the deploy.
2. The `guard-deploy.sh` hook, its wiring in `.claude/settings.json` and `.codex/hooks.json` and its tests are removed. `guard-secrets.sh` stays: agents never edit `.env*`.
3. Points 1 and 3 of ADR 0027 stand: the credential is a scoped `CLOUDFLARE_API_TOKEN` of the machine's owner, and no workflow deploys or stores a Cloudflare or Meta credential in GitHub.
4. `--skip-smoke` removes the smoke inputs check and the smoke step for a deploy the owner will verify by hand; the log says the smoke test was skipped (owner's request of 2026-11-14).
5. `backoffice:enroll` keeps its interactive terminal: it reads a password and a code that no agent may see.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep the guard and the typed word | A person is always in the loop | The owner cannot hand a deploy to an agent | The owner asked for the change |
| Remove the question and the terminal check altogether | Simplest | `pnpm deploy:production` could run by accident from any script | A flag that names the environment is a deliberate act |
| Deploy from GitHub Actions | Repeatable | A deploy-capable token in GitHub | Still excluded by ADR 0027 |

## Consequences

An agent that runs `pnpm deploy:production --confirm production` deploys to production after the same checks a person meets. The only remaining gate is the owner's decision to let the agent run it. The doctor still warns when `wrangler` is logged in, because that session is shared by every shell of the OS user.

## Evidence

`deploy-entry.test.ts`: production deploys without a terminal and without a question when `--confirm` names it, and refuses without a terminal when it names another environment; `hooks.test.sh` no longer covers the removed hook.

## Revisit when

A second maintainer joins, or a deploy ever goes out that the owner did not want.
