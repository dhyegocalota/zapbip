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

- [x] **Step 1:** Red tests: the agent id guard, the sections and cards in the page, the hint, the pricing, the copy keys. Commit alone with stubs. — evidence: c8b04181 (red, stubs; failure texts in tester-briefing.md)
- [x] **Step 2:** `install.ts` exports `InstallClient`; `site-agents.ts` lists agents with ids and guards an id; the site context reads `?agent=`; the page model carries it. — evidence: 316e401b, site-agents.test.ts
- [x] **Step 3:** Copy keys in both locales; labels, meta and FAQ. — evidence: c8b04181 (keys), 316e401b (values)
- [x] **Step 4:** Views: why section and scenes, agent cards, pricing, the hint in the join block, reveal classes. — evidence: 316e401b, 8ec0de1f, site-page.test.ts
- [x] **Step 5:** Stylesheet: scenes, cards, pricing, reveal; scroll timeline branch, observer branch, reduced motion. — evidence: 316e401b, 8ec0de1f, site-motion.test.ts (integration)
- [x] **Step 6:** Script: reveal observer, card pick. — evidence: 316e401b, site-motion.test.ts (unit)
- [x] **Step 7:** E2E: both locales, both widths, card click, reduced motion. — evidence: c8b04181, 8ec0de1f, landing-scroll-story.spec.ts and landing-free-tier.spec.ts, 62 landing specs green at 8ec0de1f
- [x] **Step 8:** Rule and README sweep; tester briefing. — evidence: `.claude/rules/site.md`, tester-briefing.md; no README states behaviour that changed

## Failure modes

| Step | What breaks | Signal | Back out |
|------|-------------|--------|----------|
| 4 | Text hidden when the script fails | the no-script page walk shows empty sections | the hidden state exists only under `has-reveal`; revert the class |
| 5 | Layout shift from a late reveal | the layout-shift e2e | animate transform and opacity only |
| 6 | Card click traps focus | the e2e checks the active element | fall back to the plain link |

**Steps with no backout:** none; all code, no data.
