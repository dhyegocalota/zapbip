# Plan: Landing motion and free tier

**Spec:** [spec.md](spec.md)
**Tier:** 🟡 medium
**Seam:** `apps/api/src/site/` (views, copy, script, stylesheet, context), `libs/agents/src/install.ts` (re-exports the install client enum the Worker may import).
**Assumptions (decided):** one developer lane; the stylesheet stays one file; the copy of every new string is in `site-copy.ts`.

## File map

| Group | Paths owned | Developer |
|-------|-------------|-----------|
| G1 | `apps/api/src/site/**`, `apps/api/test/**` for the site, `apps/api/e2e/landing/**`, `libs/agents/src/install.ts`, `.claude/rules/site.md`, this folder | developer |

## Steps

- [ ] **Step 1:** Red tests: the agent id guard, the sections and cards in the page, the hint, the pricing, the copy keys. Commit alone with stubs.
- [ ] **Step 2:** `install.ts` exports `InstallClient`; `site-agents.ts` lists agents with ids and guards an id; the site context reads `?agent=`; the page model carries it.
- [ ] **Step 3:** Copy keys in both locales; labels, meta and FAQ.
- [ ] **Step 4:** Views: why section and scenes, agent cards, pricing, the hint in the join block, reveal classes.
- [ ] **Step 5:** Stylesheet: scenes, cards, pricing, reveal; scroll timeline branch, observer branch, reduced motion.
- [ ] **Step 6:** Script: reveal observer, card pick.
- [ ] **Step 7:** E2E: both locales, both widths, card click, reduced motion.
- [ ] **Step 8:** Rule and README sweep; tester briefing.

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 4 | Text hidden when the script fails | the no-script page walk shows empty sections | the hidden state exists only under `has-reveal`; revert the class |
| 5 | Layout shift from a late reveal | the layout-shift e2e | animate transform and opacity only |
| 6 | Card click traps focus | the e2e checks the active element | fall back to the plain link |

**Steps with no backout:** none; all code, no data.
