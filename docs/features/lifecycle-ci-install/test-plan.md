# Test plan: Lifecycle CI install

Every checkbox states the input and the exact expected outcome. A ticked box carries evidence after ` — evidence: ` (commit hash, log path, counts, screenshot path).

## The failing test first

- [ ] `tools/repository-shape/src/agent-lifecycle.test.ts::resolving the lockfile after a removal needs no registry metadata, as on a runner with a cold cache` — input: a worktree at HEAD, the removed agents `git rm`-ed, `pnpm install --no-frozen-lockfile --offline` with `CI=true` and an empty `npm_config_cache_dir`; expected before the fix: exit 1 with `ERR_PNPM_NO_OFFLINE_META ... vite.json`.

## Unit

- [ ] Same test after the fix (`--prefer-offline`) — expected: exit 0.
- [ ] `removing one agent of each kind leaves the removed folders and the generated set as the only diff, and every suite stays green` — expected: green locally through `pnpm verify`, and in the `lifecycle` job of the PR's CI.
- [ ] A failed install — expected: the assertion message holds the install output.

## Coverage honesty

- A runner without network is not exercised; the resolving install would fail with a network error that the output now shows.
