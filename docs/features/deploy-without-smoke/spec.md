# Deploy without the smoke test

**Status:** Shipped 2026-11-14
**Tier:** 🟢 small
**Owner approval:** the owner asked on 2026-11-14 to deploy without the smoke test
**ADRs:** [0063](../../adr/0063-an-agent-may-deploy-when-the-command-names-the-environment.md)
**Not changing:** every other preflight check, the dry run, the rollback points

## Problem

The deploy script refused to start without six smoke test variables in `.env` that the owner did not have at hand.

## Goals

- `--skip-smoke` removes the smoke inputs check and the smoke step, says so in the log, and deploys.

## Non-goals

- Making the smoke test optional by default.

## Design

`skipSmoke` travels from `main()` to `runDeploy`, which hands it to the preflight as a flag of its smoke inputs check and skips the smoke step after the deploy, printing that it was skipped.

### Failure handling

| Failure | Outcome |
|---|---|
| Any other preflight check fails | the deploy still refuses at that step |
| The deploy fails | `the deploy failed`, exit 1, as before |

## Open questions → answers

None.

## Test strategy summary

Unit tests: the preflight skips the smoke inputs check when asked, and the entry deploys production without running `smoke.ts`.
