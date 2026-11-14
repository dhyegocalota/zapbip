# Confirmed deploy

**Status:** Shipped 2026-11-14
**Tier:** 🟡 medium
**Owner approval:** the owner asked on 2026-11-14 to remove the deploy guard and correct the deploy script so an agent can deploy, and not to cite the company's city or street address in the repository or on the website
**ADRs:** [0063](../../adr/0063-an-agent-may-deploy-when-the-command-names-the-environment.md), which supersedes [0027](../../adr/0027-deploys-run-from-the-owners-machine-not-from-ci.md)
**Not changing:** the preflight checks, the dry run, the smoke test, the scoped credential rule, the interactive `backoffice:enroll`

## Problem

A production deploy needed a terminal and the owner typing `production`, and a hook blocked every deploy command from an agent, so the owner could not hand a deploy to an agent. Separately, the company street address and the city of the court venue were published in the repository, the legal pages and the docs.

## Goals

- `pnpm deploy:production --confirm production` deploys without a terminal and without the question; every other check stays.
- No `guard-deploy.sh` hook and no test of it.
- The company facts hold no street address; the legal pages name no city; the venue clause says the courts of Brazil.

## Non-goals

- Rewriting git history that already contains the address.

## Design

### Data flow

`main()` reads `--confirm`, parses it as a `DeployEnvironment` and passes `confirmedEnvironment`. `runDeploy` treats it as `isPreConfirmed` when it equals the environment: the preflight accepts it in place of a terminal and `isDeployConfirmed` skips the question.

### Failure handling

| Failure | Outcome |
|---|---|
| `--confirm staging` for a production deploy, no terminal | refused at the environment step, nothing runs |
| Unknown `--confirm` value | `parseDeployEnvironment` throws before anything runs |

## Open questions → answers

None.

## Test strategy summary

Unit tests for the flag in `deploy-entry.test.ts`; the preflight tests use `canConfirm`; the hooks suite no longer names the removed hook; the legal, company-docs and typecheck suites cover the removed address.
