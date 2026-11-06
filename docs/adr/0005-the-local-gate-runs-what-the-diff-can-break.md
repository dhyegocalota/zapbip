# 0005. The local gate runs what the diff can break

- Status: Accepted
- Date: 2026-11-04
- Deciders: Dhyego Calota (owner); Claude (advisor)
- Inspired by: [superdoc-collab ADR 0030](https://github.com/dhyegocalota/superdoc-collab/blob/main/docs/adr/0030-the-local-gate-runs-what-the-diff-can-break.md), ported with the harness; the learning [pnpm's changed-since filter selects nothing in a linked worktree](../learnings/2026-10-17-pnpm-changed-since-selects-nothing-in-a-linked-worktree.md)

## Context

A gate written in several places disagrees with itself, and a gate that runs everything for every change makes a README typo pay for every suite, again after each review fix and each merge from `main`. Hosted CI is not the proof the harness waits for.

## Decision

1. **One executable gate.** `scripts/verify.sh`, run as `pnpm verify [auto|all] [--plan]`, is the only list of gates. Skills and `HARNESS.md` call it and never repeat its steps.
2. **A map from paths to gates.** `scripts/verify-gates.tsv` maps globs to a class and gates; first match wins per path and the union is run. A path no rule matches runs everything, as do the map, the script, the manifests, the lockfile and the toolchain pins. The doctor, Prettier on the changed files, the secret scan, the audit and the repository-shape tests always run.
3. **Unit runs the changed packages and their dependents**, read from each package's workspace dependencies.
4. **Incremental by commit.** A green run on a clean tree writes a record for its commit under the git common directory. The next run diffs from the newest recorded ancestor made with the same Node version, else from the merge base with a freshly fetched `origin/main`. Records narrow the gates, never the class: the class of the whole branch decides the lane. A guard hook blocks hand-written records.
5. **The docs lane.** A change of class `docs` that no one follows step by step takes a ten-line spec, one reviewer, no tester and no security reviewer.
6. **Tooling needs no tester.** The lead ticks the test plan with the gate output and the reviewer refutes it.
7. **The gate is local.** Merges gate on `pnpm verify` on the branch head after merging a fresh `origin/main`, with its summary posted as a PR comment.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Map from paths to gates, records per commit (chosen) | a docs change verifies in seconds; reruns cost only what changed | a script and a map to keep honest | — |
| pnpm's changed-since filter | no code | selects nothing in a linked worktree; ignores untracked files | rejected by the spike in superdoc-collab |
| Always run everything | simplest | every typo pays every suite, several times per PR | the cost lands on every change |

## Consequences

- The gate trusts that `main` is green; `pnpm verify all` is the explicit full run.
- The E2E and image gates are absent until the first app needs them; the feature that adds the first app adds them back to the script, the map and `scripts/verify.test.sh`.

## Evidence

`scripts/verify.test.sh` pins the map, the unit packages and the records in a scratch repository with stubbed tools.

## Revisit when

Hosted CI runs reliably, the workspace gains a package outside `apps/`, `libs/` or `tools/`, or a green record is ever found to hide a red gate.
