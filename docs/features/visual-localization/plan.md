# Plan: Visual localization

**Spec:** spec.md
**Tier:** 🟡 medium
**Seam:** `scripts/landing-demo/demo-copy.ts`, `record-landing-demo.ts`, `site-paths.ts`
**Assumptions (decided, owner can override):**
- The six new terminal scripts are written by this lane in native wording; the question, buttons and reply follow `site-copy*.ts`.

## File map

| Group | Paths owned | Developer sub-agent |
|-------|-------------|---------------------|
| G1 | `apps/api/scripts/**`, `apps/api/src/site/site-paths.ts`, `apps/api/site-public/site/**`, `apps/api/test/unit/{demo-copy,site-assets}.test.ts`, `apps/api/test/integration/site-*`, `docs/features/visual-localization/**` | `developer` |

## Sequencing

Code and tests first, media last, one recording at a time after the copy lane merges.

## Steps

### G1

- [ ] **Step 1:** red tests for the demo script, the Open Graph data and the per-language media
- [ ] **Step 2:** `demo-copy.ts` for eight languages, recorder and card script over every language, `--locale` flag
- [ ] **Step 3:** `siteAssetOf` without the English fallback
- [ ] **Step 4:** render the eight Open Graph cards
- [ ] **Step 5:** record the demo of each of the six languages, one at a time
- [ ] **Step 6:** docs: site rule, tester briefing

## Failure modes

| Step | What breaks | How I notice (the concrete signal) | How I back out |
|---|---|---|---|
| 5 | A recording exhausts memory | the recorder dies, load rises | repeat with `--locale` after the machine is idle |
| 3 | A language has no file | `site-assets.test.ts` red | record or render it |
