# 0027. Deploys run from the owner's machine, and CI does not deploy

- Status: Accepted
- Date: 2026-11-06
- Deciders: Dhyego Calota (owner, delegated); Claude (advisor)
- Inspired by: [ADR 0005](0005-the-local-gate-runs-what-the-diff-can-break.md), which keeps the gate local because hosted CI is not the proof the harness waits for; the owner's rule that production deploys are only ever run by the owner

## Context

A deploy needs a Cloudflare login and touches production secrets, and the migration must land before the code that reads it. The owner wants production deploys to be his act alone, and no deploy-capable credential in GitHub.

## Decision

1. Deploys run with `pnpm deploy:<environment>` on the owner's machine, with a scoped `CLOUDFLARE_API_TOKEN` exported only in the owner's interactive shell and never an OAuth `wrangler login`. The script stops at the first failed preflight check.
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

- A deploy depends on the owner's machine: Node 24, pnpm, and a scoped Cloudflare API token. The harness doctor reports the tools at session start.
- Deploys are manual. A forgotten deploy shows up as a stale Worker, which the smoke test reveals.
- The `guard-deploy.sh` hook is a strict allowlist. A command that names `wrangler`, a production package script or the deploy and smoke scripts passes only when the whole command is one anchored form (`wrangler dev`, a `--dry-run` deploy, local D1, types, version, whoami, `git commit -F <file>`, and the read, stage and test heads `git add|diff|show|status|log|restore --staged`, `cat`, `head`, `tail`, `wc`, `sed -n`, `grep`, `rg` and `vitest run` / `pnpm test`, never with `--pre`, `--pre-glob`, `-O`, `--open-files-in-pager`, `-x`, `--exec` or `--hostname-bin`, because a head without a metacharacter cannot chain) with none of the shell metacharacters (semicolon, pipe, ampersand, dollar, backtick, angle brackets, parentheses, braces, hash, backslash) and no newline; there is no exemption for read-only heads, quoted text or heredoc bodies. It is defence in depth, not a sandbox: a shell string can always be built that a text scan misses.
- The real control is enforced, not stated: on every call the hook checks the real state, a wrangler OAuth config file at the macOS, XDG or legacy path (existence only, never read) or `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_API_KEY` in its environment, and when one exists it refuses every wrangler command except `whoami`, `--version` and `logout`; the doctor reports the same check as a warning line that does not fail the verify gate. There is no marker file to forge. The owner runs `wrangler logout` on this machine and deploys with a scoped API token exported only in his own shell and unset afterwards, so no agent shell ever holds a deploy-capable credential, and agents cannot run wrangler at all while a login exists. A deploy passes the guard only as one bare `--dry-run` with no other argument naming dry-run, no-dry or a boolean value, and `--remote` or any short flag cluster holding `r` is refused.

## Evidence

- The autonomy rules of 2026-11-06: agents never deploy, and production deploys are the owner's. The `guard-deploy.sh` PreToolUse hook enforces it for Claude Code and Codex: it allows only the anchored `wrangler` forms above and blocks every other command that names `wrangler`, the `deploy:*`, `migrate:staging|production` and `secrets:*` package scripts, or the deploy and smoke scripts.
- [ADR 0005](0005-the-local-gate-runs-what-the-diff-can-break.md): hosted CI is not proof.

## Revisit when

- Hosted CI runs reliably and a second maintainer joins.
- The owner asks for a staging deploy on every merge.
