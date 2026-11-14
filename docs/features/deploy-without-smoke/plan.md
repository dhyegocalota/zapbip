# Plan: Deploy without the smoke test

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** `apps/api/scripts/deploy.ts`, `apps/api/src/operations/deploy-preflight.ts`
**Assumptions (decided, owner can override):**
- None.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | the two files above and their unit tests | `developer` |

## Sequencing

One lane.

## Steps

### G1

- [x] **Step 1:** the flag through `main`, `runDeploy` and the preflight — evidence: `deploy-entry.test.ts`, `deploy-preflight.test.ts`

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | A bad deploy goes out unchecked | the owner runs the smoke test by hand | revert the pull request and redeploy |
