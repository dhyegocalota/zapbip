# The secrets gate fails on a branch whose own history is clean

- Date: 2026-11-07
- Inspired by: `pnpm verify` failing on `feat/docs-experience` for a TOTP test vector committed only on `feat/backoffice-g2`
- Revisited: 2026-11-07 — still true

## Signal
`verify: secrets failed` on a branch that added no secret; the reported commit is not reachable from `HEAD`.

## Cause
`gitleaks git` defaults to `git log --all`, and every lane's branch lives in the one shared repository.

## Do
Scan the history the checked-out branch brings: `--log-opts=HEAD`. The hosted job keeps scanning all refs on purpose.

## Anchor
`scripts/verify.sh` (`gate_secrets`), `scripts/verify.test.sh`, `docs/features/verify-secrets-scan-head/`
