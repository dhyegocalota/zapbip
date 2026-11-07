# Plan: Logic Bit facts

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** `COMPANY` in `libs/types` and the two company snippets
**Assumptions (decided, owner can override):**
- The legal name is the owner's name.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `libs/types/src/constants.ts`, `apps/docs/snippets/**/company.mdx`, `tools/repository-shape/src/company-docs.test.ts` | `developer` |

## Sequencing

One group, one lane.

## Steps

### G1

- [x] **Step 1:** red: `company-docs.test.ts` asserts every fact equals the published value — evidence: 96ed001
- [x] **Step 2:** set the facts in `COMPANY` and list them in both snippets — evidence: b362b6c (constants), df190b9 (snippets)

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 2    | A snippet row disagrees with `COMPANY` | the snippet tests in `company-docs.test.ts` | revert the commit |

**Steps with no backout:** none

## Z. Prove and ship

- [x] **Tester briefing:** not applicable, docs and constants only; the gate and the walk are the proof.
- [ ] **Tester run:** not applicable.
- [x] **Reviewer:** WITH RESERVATIONS, all minors fixed (names, evidence commits, facts checked against the site).
- [x] **/check-ui:** the about pages walked at 1280 and 375, see test-plan.md.
- [x] **/open-pr:** gates passed, learnings sweep: none, PR opened.
