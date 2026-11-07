# Verify secrets scan HEAD

**Status:** Building
**Tier:** 🟢 small
**Owner approval:** approved 2026-11-06 (owner delegated)
**ADRs:** none
**Not changing:** the CI `security` job, which keeps scanning every commit on every branch

## Problem

`pnpm verify` ran `gitleaks git` without `--log-opts`, so gitleaks scanned every ref of the shared repository. A commit that exists only on `feat/backoffice-g2` (an RFC 6238 TOTP test vector) failed the secrets gate on the unrelated branch `feat/docs-experience`.

## Goals

- The secrets gate scans exactly the history the checked-out branch would bring: `HEAD`'s history, through `--log-opts=HEAD`.

## Non-goals

- Changing the hosted `security` job: it deliberately scans all refs and is not run today (ADR 0005).

## Design

### Data flow

`gate_secrets` runs the rules probe, then `gitleaks git --log-opts=HEAD` over the repository. A secret in a commit reachable from `HEAD` still fails; one reachable only from another branch is ignored.

### Failure handling

A leak in `HEAD`'s history fails the gate as before. Back out by reverting the one-line change.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Limit the local scan to `HEAD` | all refs, `HEAD` | `HEAD` (owner delegated) | 2026-11-06 |

## Test strategy summary

`scripts/verify.test.sh` with a gitleaks stub that scans the revisions it is given: a secret only on another branch passes, a secret in `HEAD`'s history fails.
