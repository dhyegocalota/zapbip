# Learnings

Dated traps that cost time. Each one is stated as the symptom you will see again, with the cause, the move that avoids it, and anchors in code, tests or commits.

Format: `.claude/HARNESS.md` section 8. Write them with the `learning` skill.

## Promotion

A learning that recurs is promoted in the same change that taught it again: a fact to `.claude/rules/`, a process to `.claude/HARNESS.md`, a mechanical check to a hook, a repeatable procedure to a skill. Keep the learning and link to where it went.

Every learning touched by a change gets a `Revisited` line appended.

## Index

### testing

| Date | Title | File | Last revisited |
|------|-------|------|----------------|
| 2026-10-17 | `shouldAdvanceTime` lets real lag move the fake clock, so a timer test passes alone and fails under load | [2026-10-17-should-advance-time-lets-real-lag-move-the-fake-clock.md](2026-10-17-should-advance-time-lets-real-lag-move-the-fake-clock.md) | 2026-11-04 |
| 2026-11-07 | A heartbeat or promptness test passes alone and fails once in a full run on a busy machine | [2026-11-07-wall-clock-assertions-in-asyncio-tests-flake-under-load.md](2026-11-07-wall-clock-assertions-in-asyncio-tests-flake-under-load.md) | 2026-11-07 |
| 2026-11-07 | A test that asserts no timing fails with a 5 s timeout and then later tests fail with `no such table` | [2026-11-07-default-test-timeout-measures-the-machine-under-load.md](2026-11-07-default-test-timeout-measures-the-machine-under-load.md) | 2026-11-07 |

### tooling

| Date | Title | File | Last revisited |
|------|-------|------|----------------|
| 2026-10-16 | A red-first claim cannot be verified when test and code share a commit | [2026-10-16-commit-the-failing-test-first.md](2026-10-16-commit-the-failing-test-first.md) | 2026-11-04 |
| 2026-10-16 | A commit from one lane sweeps in files another lane staged | [2026-10-16-parallel-lanes-share-one-git-index.md](2026-10-16-parallel-lanes-share-one-git-index.md) | 2026-11-04 |
| 2026-10-16 | A red-first commit must fail on the named assertion, not on a missing module | [2026-10-16-a-red-first-commit-must-fail-on-the-named-assertion.md](2026-10-16-a-red-first-commit-must-fail-on-the-named-assertion.md) | 2026-11-04 |
| 2026-10-17 | A guard hook blocks a harmless command because the forbidden flag appears in quoted prose | [2026-10-17-a-guard-hook-matches-the-flag-inside-quoted-prose.md](2026-10-17-a-guard-hook-matches-the-flag-inside-quoted-prose.md) | 2026-11-04 |
| 2026-10-17 | pnpm's changed-since filter selects nothing in a linked worktree | [2026-10-17-pnpm-changed-since-selects-nothing-in-a-linked-worktree.md](2026-10-17-pnpm-changed-since-selects-nothing-in-a-linked-worktree.md) | 2026-11-04 |
| 2026-10-17 | GitHub Actions may create no run for a push or PR, and tight API polling trips the secondary rate limit | [2026-10-17-github-actions-may-create-no-run-and-tight-polling-trips-the-rate-limit.md](2026-10-17-github-actions-may-create-no-run-and-tight-polling-trips-the-rate-limit.md) | 2026-11-04 |
| 2026-10-17 | A hook that parses `git status --porcelain` maps a path with a space to the wrong folder | [2026-10-17-git-status-porcelain-quotes-paths-with-spaces.md](2026-10-17-git-status-porcelain-quotes-paths-with-spaces.md) | 2026-11-04 |
| 2026-10-17 | A session-start hook runs whatever a repository file contains when bash compares it with -ge | [2026-10-17-a-session-start-hook-runs-whatever-a-repository-file-contains.md](2026-10-17-a-session-start-hook-runs-whatever-a-repository-file-contains.md) | 2026-11-04 |
| 2026-10-17 | A `pnpm <name>` step is green in under a second and prints nothing the script would print | [2026-10-17-a-script-named-like-a-pnpm-built-in-never-runs.md](2026-10-17-a-script-named-like-a-pnpm-built-in-never-runs.md) | 2026-11-04 |
| 2026-10-17 | The typecheck fails with a duplicate declaration in libs/types right after a lane merge | [2026-10-17-merging-lanes-that-mirror-one-shared-constant-duplicates-the-declaration.md](2026-10-17-merging-lanes-that-mirror-one-shared-constant-duplicates-the-declaration.md) | 2026-11-04 |
| 2026-10-19 | A self-test that greps the whole output matches a commit hash | [2026-10-19-a-self-test-that-greps-the-whole-output-matches-a-commit-hash.md](2026-10-19-a-self-test-that-greps-the-whole-output-matches-a-commit-hash.md) | 2026-11-04 |
| 2026-10-19 | The index says Building for a feature that merged two days ago | [2026-10-19-shipped-status-written-in-follow-up-prs-goes-stale.md](2026-10-19-shipped-status-written-in-follow-up-prs-goes-stale.md) | 2026-11-04 |
| 2026-11-06 | The MCP SDK subpath import compiles without `.js` and then fails to bundle | [2026-11-06-mcp-sdk-subpath-keeps-the-js-suffix.md](2026-11-06-mcp-sdk-subpath-keeps-the-js-suffix.md) | 2026-11-06 |
| 2026-11-06 | `mint dev` shows no component and the console says `__dirname is not defined` | [2026-11-06-mint-dev-downloads-the-latest-client-and-one-release-broke-every-page.md](2026-11-06-mint-dev-downloads-the-latest-client-and-one-release-broke-every-page.md) | 2026-11-06 |
| 2026-11-06 | The secrets gate fails on a branch whose own history is clean | [2026-11-06-gitleaks-git-scans-every-ref-unless-given-log-opts.md](2026-11-06-gitleaks-git-scans-every-ref-unless-given-log-opts.md) | 2026-11-06 |
