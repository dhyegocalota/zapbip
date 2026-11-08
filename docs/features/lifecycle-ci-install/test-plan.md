# Test plan: Lifecycle CI install

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [x] `tools/repository-shape/src/agent-lifecycle-removal.test.ts::resolving the lockfile after a removal needs no registry metadata, as on a runner with a cold cache` — input: a worktree at HEAD, the removed agents `git rm`-ed, `pnpm install --no-frozen-lockfile --offline` with `CI=true` and an empty `npm_config_cache_dir`; expected before the fix: exit 1 with `ERR_PNPM_NO_OFFLINE_META ... vite.json`. — evidence: 5860c5b4 red (agent-lifecycle.test.ts, `-t`) printed `ERR_PNPM_NO_OFFLINE_META ... vite.json`, 1 failed; a8e07999 (now agent-lifecycle-removal.test.ts) 1 passed

- [x] `apps/connector/test/integration/listen.test.ts::prints one JSON line per owner message even when the output pipe is read late, as on a loaded machine` — input: the output pipes are read 300 ms late; expected before the fix: `expected [] to deeply equal [ { messageId: 'msg_1', ... } ]`; after: the line is printed. — evidence: 927c36b4 red printed `expected [] to deeply equal [ { messageId: 'msg_1', ... } ]`; a8e07999 listen.test.ts 9 passed

- [x] `tools/repository-shape/src/ci-workflow.test.ts::the lifecycle job runs as a matrix of shards, none cancelling the others` `::the lifecycle proofs sit in at least as many files as there are shards and run one file at a time` and `::the lifecycle job has its own long timeout` — expected before: both fail; after: pass. `vitest run --config vitest.lifecycle.config.ts --shard=<i>/3` selects 2, 2 and 1 files. — evidence: 82576d01 red: matrix test `expected ... to contain 'fail-fast: false'`, files test `expected 0 to be greater than or equal to 3` (the timeout test failed too); a8e07999 3 passed; `vitest run --shard=i/3` selects 2, 2, 1 files

## Unit

- [x] Same test after the fix (`--prefer-offline`) — expected: exit 0. — evidence: a8e07999 agent-lifecycle-removal.test.ts `-t "needs no registry metadata"` 1 passed (exit 0); CI run 42513973635 lifecycle (3) green in 12155 ms
- [x] `removing one agent of each kind leaves the removed folders and the generated set as the only diff, and every suite stays green` — expected: green locally through `pnpm verify`, and in the `lifecycle` job of the PR's CI. — evidence: CI run 42513973635, all 8 jobs success incl. lifecycle (1)(2)(3), removal proof ✓ in lifecycle (3) (459477 ms); local `pnpm verify` not re-run by the tester (forbidden)
- [x] A failed install — expected: the assertion message holds the install output. — evidence: throwaway test (deleted) with a bogus dependency, Resolve install: assertion message printed `ERR_PNPM_FETCH_404 GET .../zapbip-bogus-package-xyz: Not Found - 404`

## Coverage honesty

- A runner without network is not exercised; the resolving install would fail with a network error that the output now shows.
