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

- [x] **Step 1:** red: `inspectWorker` on the real `createApp` and source root reports the install route (test: sees the install route of the app built as the deploy builds it)
- [x] **Step 2:** accept `ALL` next to `GET` (fix commit)

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2 | A POST-only route counts as served | the POST-only test goes red | revert the commit |

**Steps with no backout:** none

## Z. Prove and ship

- [x] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict — WITH RESERVATIONS, all three findings fixed in 2577eb37
- [x] **/open-pr:** gates passed, PR opened — PR #25
