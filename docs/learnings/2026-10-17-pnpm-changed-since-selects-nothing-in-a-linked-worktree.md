# pnpm's changed-since filter selects nothing in a linked worktree

- Date: 2026-10-17
- Inspired by: the spike for [ADR 0030](https://github.com/dhyegocalota/superdoc-collab/blob/main/docs/learnings/../adr/0030-the-local-gate-runs-what-the-diff-can-break.md)
- Revisited: 2026-11-04 — ported with the harness from [superdoc-collab](https://github.com/dhyegocalota/superdoc-collab); the paths under Inspired by and Anchor name that repository

## Signal
`pnpm --filter "...[main]" exec pwd` (or `[HEAD~1]`) prints `No projects matched the filters` in a worktree created with `git worktree add` under the scratchpad, even right after a commit that changed `libs/types/src/index.ts`, while `pnpm --filter "./libs/*" exec pwd` lists both libraries.

## Cause
Not diagnosed further; the worktree lives under `/private/tmp` (reached through the `/tmp` symlink), which is where agents run lanes. pnpm's changed-since selection also never looks at untracked files.

## Do
Never rely on pnpm's `[ref]` filters to pick what to test. `scripts/verify.sh` computes the changed packages from `git diff --no-renames` plus untracked files and adds their dependents from each `package.json`.

## Anchor
`scripts/verify.sh`, `scripts/verify.test.sh`, ADR 0030
