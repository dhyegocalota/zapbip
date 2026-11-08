# Plan: Preflight pre-launch

**Spec:** spec.md
**Tier:** 🟡 medium
**Seam:** `apps/api/src/operations/deploy-preflight.ts`, `apps/api/scripts/deploy.ts`
**Assumptions (decided, owner can override):**
- The warning channel is a `warn` callback in the Worker preflight input.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/operations/deploy-preflight.ts`, `apps/api/scripts/deploy.ts`, `apps/api/test/unit/deploy-preflight.test.ts`, `apps/api/test/unit/deploy-entry.test.ts`, `apps/api/test/e2e/deploy-dry-run.e2e.test.ts`, `docs/runbooks/deploy.md`, `docs/runbooks/mintlify-publish.md` | `developer` |

## Sequencing

One group, one lane.

## Steps

### G1

- [x] **Step 1:** red: the Worker preflight passes with the number unset; E404 warns and passes; foreign maintainer and network error refuse
- [x] **Step 2:** remove the official number check from `WORKER_CHECKS`, the Worker input type and `DeployRun`; add the `warn` callback and `onAbsentPackage`
- [x] **Step 3:** update the deploy and Mintlify runbooks
- [x] **Step 4:** security findings: an absent version checks the package name, a typed warning printed again after the smoke test, the go-live record line, the docs `E404` pin

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A squatted package slips through as absent | a foreign-maintainer test goes red | revert the commit |
| 2 | The warning is lost | the deploy entry test finds no warning in the output | revert the commit |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** `tester-briefing.md` written.
- [ ] **Tester run:** a fresh `tester` sub-agent ticked `test-plan.md` with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/check-ui:** not applicable.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
