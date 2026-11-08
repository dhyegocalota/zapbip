# Plan: README review

**Spec:** spec.md
**Tier:** 🟢 small
**Seam:** the `README.md` files and `tools/repository-shape/src/delivery-docs.test.ts`
**Assumptions (decided, owner can override):**
- The README edits start only after `feat/agent-registry` has merged into `main`.
- The audit texts are the starting point; the re-audit may amend them.
- The purpose-only test lives in `delivery-docs.test.ts`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `tools/repository-shape/src/delivery-docs.test.ts` | `developer` |
| G2 | `README.md`, `.agents/skills/README.md`, `tools/repository-shape/README.md` | `developer` |
| G3 | `apps/api/README.md`, `apps/connector/README.md`, `apps/docs/README.md`, `apps/hermes-plugin/README.md`, `apps/openclaw-plugin/README.md` | `developer` |
| G4 | `libs/core/README.md`, `libs/types/README.md`, `libs/agents/README.md` | `developer` |

## Sequencing

Step 1 is first and gates the rest. G1 can run beside it. G2, G3 and G4 are disjoint and run in parallel after step 1 writes the final texts into the plan.

## Steps

Author this list with every box empty. A sub-agent ticks its own line. A wrong step is struck through with the reason, not deleted.

### Re-audit

- [ ] **Step 1:** after `feat/agent-registry` merges, merge `origin/main` into this branch, then read every README against the code on `main` and record the findings and the final texts in this plan, one block per README. Include the READMEs the audit did not cover (`libs/agents`) and any added since.

### G1

- [ ] **Step 2:** red: `purposeViolations` probes (a code span, a fenced block and a file link are reported; folder links and plain prose are not) and the `test.each` over workspace package READMEs, with a stub that throws `purposeViolations is not implemented`; commit alone
- [ ] **Step 3:** implement `purposeViolations`; the probes go green and the real run stays red only on READMEs still violating the rule

### G2

- [ ] **Step 4:** root `README.md`: replace "Early stage", add the runbooks link, keep the Logic Bit line
- [ ] **Step 5:** `.agents/skills/README.md`: the shortened text
- [ ] **Step 6:** `tools/repository-shape/README.md`: the category text

### G3

- [ ] **Step 7:** `apps/api/README.md`
- [ ] **Step 8:** `apps/hermes-plugin/README.md`: drop the file pointer
- [ ] **Step 9:** `apps/connector/README.md`, `apps/docs/README.md`, `apps/openclaw-plugin/README.md`: only the registry-driven rewording, or confirm unchanged

### G4

- [ ] **Step 10:** `libs/core/README.md`
- [ ] **Step 11:** `libs/types/README.md`
- [ ] **Step 12:** `libs/agents/README.md`: confirm against the final folders; amend only if wrong

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 1 | A README is checked against the branch, not `main`, and the text is wrong after the merge | the tester finds a claim with no code behind it | redo the re-audit on `main` |
| 3 | The rule is too strict and flags a legitimate README | the shape test lists a package README | the owner decides; relax the rule or fix the README, never skip the package |
| 4 | The Logic Bit line is dropped | `company-docs.test.ts` fails | restore the line |
| 7 to 12 | A link names a moved folder | `delivery-docs.test.ts` link check fails | repoint the link |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** a developer wrote `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` sub-agent executed `test-plan.md` and ticked every box with evidence.
- [ ] **Reviewer:** a fresh `reviewer` sub-agent returned a verdict; refutation of the three riskiest claims is recorded in `test-plan.md`.
- [ ] **/check-ui:** not applicable.
- [ ] **/open-pr:** gates passed, learnings sweep stated, PR opened.
