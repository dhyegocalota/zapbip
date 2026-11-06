# 0002. Mechanical security gates and a dedicated security reviewer before every PR

- Status: Accepted
- Date: 2026-11-04
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [superdoc-collab ADR 0022](https://github.com/dhyegocalota/superdoc-collab/blob/main/docs/adr/0022-mechanical-security-gates-and-a-security-reviewer.md), ported with the harness

## Context

zapbip holds API keys, verification codes, the owner's private messages and a shared WhatsApp number whose suspension takes every account down. A general reviewer splits its attention across conventions, correctness, performance and tests, and nothing mechanical catches a leaked secret or a known-vulnerable dependency.

## Decision

1. The local gate and the `security` job of `verify.yml` run `pnpm security:audit` (`pnpm audit --prod --audit-level=high`) and a `gitleaks git` scan of every commit on every branch and tag, from a binary pinned by version and SHA-256. A probe proves the rules fire on a fresh token and stay silent on a shipped placeholder. CI also scans the checked-out tree with `gitleaks dir`.
2. A production advisory with no fix lands in `pnpm.auditConfig.ignoreCves` with the CVE and the reason in the same commit, never silently.
3. A `security-reviewer` role (fresh context, read-only, strongest model) attacks every diff outside the docs lane with this repository's threat model, after the general reviewer. Its verdict (`CLEAR | FINDINGS | NOT APPLICABLE`) goes into the PR body under `## Security`.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Audit + gitleaks + security-reviewer role (chosen) | scanners catch the boring leaks; a single-purpose agent attacks the diff | one more sub-agent per PR | — |
| Security as one lens of the general reviewer | no new role | attack paths get under-weighted; nothing mechanical runs | judgment alone never ran a scanner |
| Audit the whole tree at `moderate` | catches dev tooling too | red on day one for advisories nobody can fix | a gate that starts with exceptions trains everyone to add more |

## Consequences

- A new production advisory at `high` blocks the merge until the dependency is bumped or the CVE is listed with a reason.
- A leaked secret blocks every PR until it is rotated and the history cleaned. The allowlist in `.gitleaks.toml` holds exact anchored strings only.
- `/open-pr` gate 3b is the security verdict; `FINDINGS` at `CRITICAL` or `IMPORTANT` goes back to Build.

## Evidence

`.github/scripts/secret-rules-probe.sh`; `tools/repository-shape/src/ci-workflow.test.ts` pins the security job.

## Revisit when

- The server grows enough surface for CodeQL's taint tracking to pay for its minutes.
- A security finding reaches `main` through a path neither the scanners nor the role covers.
