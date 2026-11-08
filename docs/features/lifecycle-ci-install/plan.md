# Plan: Lifecycle CI install

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** `tools/repository-shape/src/throwaway-worktree.ts` and `agent-lifecycle.test.ts`
**Assumptions (decided, owner can override):**
- The runner has network access during the lifecycle job.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `tools/repository-shape/src/throwaway-worktree.ts`, `tools/repository-shape/src/agent-lifecycle.test.ts` | `developer` |

## Steps

### G1

- [x] **Step 1 (red):** `installDependencies` with a cold metadata cache and `CI=true`; every proof install uses it and prints its output; a fast test resolves the lockfile after the removal. Fails locally with `ERR_PNPM_NO_OFFLINE_META`.
- [x] **Step 2:** the resolving installs use `--prefer-offline`.

- [x] **Step 3:** red `927c36b4` reads the child's output 300 ms late and fails with the CI message; the listen tests wait on the pipes (`waitForPrintedLines`, `waitForStandardError`).
- [x] **Step 4:** red `82576d01` pins the shard matrix, the `--shard` step and at least three proof files run one at a time; the proofs are split into five files with a shared `agent-lifecycle-support.ts`, the workflow gets `matrix.shard: [1, 2, 3]` with `fail-fast: false`.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a runner without network | the install prints a network error in the failed assertion | restore `--offline` and warm the metadata cache |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester run:** the `lifecycle` job of the PR's CI is green.
- [ ] **/open-pr:** opened by the lead.
