# Lifecycle CI install

**Status:** Shipped 2026-11-08
**Tier:** 🟢 small
**Owner approval:** approved 2026-11-08 (lead order after main CI went red)
**ADRs:** none
**Not changing:** product code under `apps/*/src` and `libs/*/src`; what the lifecycle gate proves

## Problem

Main CI went red after the agent-registry merge (run 42499426893, push 1750a209): the `lifecycle` job failed in `removing one agent of each kind ...` at the `pnpm install --no-frozen-lockfile --offline` step, 923 ms in, with no message because the assertion printed only the exit code. The same test passed locally.

Root cause, reproduced locally: with `--offline`, pnpm resolves the lockfile after a removal from the local package metadata cache. A developer machine has it; a fresh runner holds only the tarball store, so pnpm exits 1 with `ERR_PNPM_NO_OFFLINE_META` (`Failed to resolve vite@... in package mirror .../metadata/registry.npmjs.org/vite.json`). The frozen installs of the scaffold proofs read only the lockfile, which is why they passed in CI.

A second failure showed once the first was fixed (PR #23, run 42505229057): inside the install-agent scaffold proof, `apps/connector/test/integration/listen.test.ts` "prints one JSON line per owner message and acknowledges it after printing" got `expected [] to deeply equal [ { messageId: 'msg_1', ... } ]`. The test waits for the fake server to receive the `done` frame, then reads the child's stdout. The `done` frame travels over the socket and the line over the stdout pipe, so the parent can see the first before the second when the machine is loaded.

With both fixed, run 42509461944 (PR #23) had every job green except `lifecycle`, cancelled at the 30-minute limit: the proofs had taken about 1736 s of test time before the removal proof started running its suites, and it now does.

## Goals

- Every install of the lifecycle proofs runs with a cold metadata cache (`npm_config_cache_dir` in the throwaway folder) and `CI=true`, so a developer machine behaves like a runner.
- The installs that resolve the lockfile use `--prefer-offline`: the store and cached metadata first, the network when metadata is missing. The frozen installs keep `--offline`.
- A failed install prints its output.
- The listen tests wait for the printed lines (and the connected log line) on the child's pipes before reading them, instead of inferring them from a frame the server received.

- The lifecycle CI job is a matrix of three shards (`pnpm test:lifecycle --shard=<i>/3`). Vitest shards by file, so the proofs sit in five files (`agent-lifecycle-removal`, `-checks`, and one scaffold file per kind) that run one at a time (`fileParallelism: false`, the API integration suites bind fixed ports). `pnpm verify all` still runs the whole lifecycle gate in one command.

## Non-goals

- Changing what the lifecycle proofs assert.

## Design

`installDependencies({ directory, lockfile })` in `throwaway-worktree.ts` is the only place the proofs run `pnpm install`. A new fast test resolves the lockfile after the removal with nothing else, so the failure shows in seconds instead of after the suites.

## Open questions → answers

| Question | Options | Owner's answer | Date |
|----------|---------|----------------|------|
| Which flag for the resolving install? | `--prefer-offline` · `--offline` with a pre-warmed metadata cache | recommended: `--prefer-offline`; the runner has the network and nothing needs warming (lead order) | 2026-11-08 |

## Test strategy summary

A lifecycle test reproduces the runner condition locally (cold cache, `CI=true`) and goes red first. CI on the branch runs the real `lifecycle` job.
