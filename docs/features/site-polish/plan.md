# Plan: Site polish

**Spec:** spec.md
**Tier:** 🟡
**Seam:** `apps/api/src/site` views, copy and stylesheet
**Assumptions (decided, owner can override):**
- "Request access" is the name; no better word was needed.
- The referral gate is a constant, not the settings row, because the panel is a view concern.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/src/site/**`, `apps/api/test/integration/site-*`, `apps/api/test/unit/code-tokens.test.ts`, `apps/api/e2e/landing/**`, `libs/types/src/constants.ts` (contact email), docs and rule text | `developer` |

## Sequencing

One developer, red tests first, then the views, then the stylesheet, then the Playwright walk.

## Steps

### G1

- [x] **Step 1:** failing integration tests for footer, CTA, example link, thank-you, pt copy, support address — 1b09e85e
- [x] **Step 2:** failing unit test for the URL token — be32a858
- [x] **Step 3:** footer, header, CTA copy, example link, thank-you split, pt copy, stylesheet — e26bac80
- [x] **Step 4:** support address everywhere — 6c04343a
- [x] **Step 5:** Playwright footer spec, language, join, cap and free-tier specs updated; screenshots — see the tester briefing
- [x] **Step 6:** rule and docs updated

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|------|-------------|------------------------------------|----------------|
| 3 | Footer menu clipped by an overflow rule | `landing-footer.spec.ts` click is intercepted | revert the stylesheet commit |
| 3 | Wrapped code block changes typing animation | `landing-quick-start.spec.ts` fails | restore `white-space: pre` |

**Steps with no backout:** none

## Z. Prove and ship

- [ ] **Tester briefing:** written in `tester-briefing.md`.
- [ ] **Tester run:** a fresh `tester` executed `test-plan.md`.
- [ ] **Reviewer:** a fresh `reviewer` returned a verdict.
- [ ] **/check-ui:** screenshots and video recorded.
- [ ] **/open-pr:** gates passed, PR opened.
