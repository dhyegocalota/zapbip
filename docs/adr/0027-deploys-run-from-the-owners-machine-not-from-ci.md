# 0027. Deploys run from the owner's machine, and CI does not deploy

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: [ADR 0005](0005-the-local-gate-runs-what-the-diff-can-break.md), which keeps the gate local because hosted CI is not the proof the harness waits for; the owner's rule that production deploys are only ever run by the owner

## Context

A deploy needs a Cloudflare login and touches production secrets, and the migration must land before the code that reads it. The owner wants production deploys to be his act alone, and no deploy-capable credential in GitHub.

## Decision

1. Deploys run with `pnpm deploy:<environment>` on the owner's machine, after `wrangler login`. The script stops at the first failed preflight check.
2. A production deploy needs an interactive terminal and the owner typing `production`, so no agent or unattended script can finish it.
3. No workflow deploys, and no Cloudflare or Meta credential is stored in GitHub.
4. Agents run the gate. They never run a deploy script, for either environment.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| GitHub Actions deploys on merge to `main`, with a Cloudflare token in repository secrets | automatic; repeatable; a deploy history in GitHub | a deploy-capable token lives in GitHub; production changes without the owner's act; hosted CI is not the proof under ADR 0005 | breaks the owner-only rule |
| Cloudflare Workers Builds connected to the repository | builds from git; no token in GitHub | deploys on push from a dashboard setting; the preflight, the secrets check and the smoke test live outside the repository | the checks would not be in the harness |
| A manual `wrangler deploy` with a written checklist | nothing to build | the order (migrate, then deploy) and the secrets check depend on memory | the failure this slice exists to prevent |

## Consequences

- A deploy depends on the owner's machine: Node 24, pnpm, and a Cloudflare login. The harness doctor reports these at session start.
- Deploys are manual. A forgotten deploy shows up as a stale Worker, which the smoke test reveals.

## Evidence

- The autonomy rules of 2026-11-06: agents never deploy, and production deploys are the owner's. The `guard-deploy.sh` PreToolUse hook enforces it for Claude Code and Codex: it blocks `wrangler deploy`, `versions deploy`, `rollback`, `secret put`, any `d1 ... --remote` and the `pnpm deploy:*` and `migrate:staging|production` scripts, and allows a `--dry-run`.
- [ADR 0005](0005-the-local-gate-runs-what-the-diff-can-break.md): hosted CI is not proof.

## Revisit when

- Hosted CI runs reliably and a second maintainer joins.
- The owner asks for a staging deploy on every merge.
