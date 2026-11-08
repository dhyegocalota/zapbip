# Plan: Install route readiness

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** `apps/api/src/operations/worker-facts.ts`

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/operations/worker-facts.ts`, `apps/api/test/unit/worker-facts.test.ts` | `developer` |

## Sequencing

One group, one lane.

## Steps

### G1

- [ ] **Step 1:** red: `inspectWorker` on the real `createApp` and source root reports the install route
- [ ] **Step 2:** accept `ALL` next to `GET`

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A POST-only route counts as served | the POST-only test goes red | revert the commit |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict.
- [ ] **/open-pr:** gates passed, PR opened.
