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
- [ ] **Step 2:** the resolving installs use `--prefer-offline`.

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | a runner without network | the install prints a network error in the failed assertion | restore `--offline` and warm the metadata cache |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester run:** the `lifecycle` job of the PR's CI is green.
- [ ] **/open-pr:** opened by the lead.
